import "reflect-metadata";
import cluster from "node:cluster";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PlanService } from "@kora/api/services/plan.service";
import { auth } from "@kora/auth";
import prisma from "@kora/db";
import { env } from "@kora/env/server";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";

import { AppModule } from "./app.module";
import { ensureProgramTemplates } from "./sync/seed.util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function logAuthAudit(event: string, data: Record<string, unknown>) {
  console.info(
    "[AUDIT_AUTH]",
    JSON.stringify({
      at: new Date().toISOString(),
      event,
      ...data,
    }),
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const trustedOrigins = env.CORS_ORIGIN?.split(",") || [];
      // Only allow local development origin in non-production
      if (process.env.NODE_ENV !== "production") {
        trustedOrigins.push("http://localhost:8081");
      }
      trustedOrigins.push("kora://");

      if (
        !origin ||
        trustedOrigins.includes(origin) ||
        trustedOrigins.includes("*")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "expo-origin"],
    credentials: true,
  });

  const expressApp = app.getHttpAdapter().getInstance();

  // 1. Manually add body parsing early
  const { default: express } = await import("express");
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  // biome-ignore lint/suspicious/noExplicitAny: generic object redaction
  const redactSensitiveFields = (obj: any): any => {
    if (typeof obj !== "object" || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(redactSensitiveFields);
    const newObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (
        key.toLowerCase().includes("password") ||
        key.toLowerCase().includes("token")
      ) {
        newObj[key] = "[REDACTED]";
      } else {
        newObj[key] = redactSensitiveFields(value);
      }
    }
    return newObj;
  };

      // 2. Debug Logger (after body parsing)
  app.use(
    (
      req: { method: string; url: string; body: unknown },
      _res: unknown,
      next: () => void,
    ) => {
      if (req.url.includes("/trpc/")) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        if (req.method === "POST") {
          console.log(
            "[REQ BODY]",
            JSON.stringify(redactSensitiveFields(req.body)),
          );
        }
      }
      next();
    },
  );

  // 3. Health check endpoints
  expressApp.get("/api/health/auth", async (req: Request, res: Response) => {
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      res.json({
        ok: true,
        session: session
          ? { userId: session.user.id, expires: session.session.expiresAt }
          : null,
      });
    } catch (_e) {
      res.status(500).json({ ok: false, error: "Session check failed" });
    }
  });

  // 3a. Connectivity Test Endpoint
  expressApp.post("/api/test-post", (req: Request, res: Response) => {
    res.json({
      ok: true,
      message: "POST received successfully",
      echo: req.body,
    });
  });

  // 3b. Onboarding status for route gating on mobile/web clients
  expressApp.get(
    "/api/onboarding/status",
    async (req: Request, res: Response) => {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
          return res.status(401).json({ ok: false, message: "Unauthorized" });
        }

        const onboarding = await prisma.onboarding.findUnique({
          where: { userId: session.user.id },
        });

        const onboardingCompleted = !!(
          onboarding?.goal &&
          onboarding?.trainingLevel &&
          onboarding?.trainingDaysPerWeek &&
          onboarding?.gender
        );

        return res.json({
          ok: true,
          onboardingCompleted,
        });
      } catch {
        return res
          .status(500)
          .json({ ok: false, message: "Failed to check onboarding status" });
      }
    },
  );

  // 3c. Complete onboarding with explicit field allowlist
  expressApp.post(
    "/api/onboarding/complete",
    async (req: Request, res: Response) => {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
          return res.status(401).json({ ok: false, message: "Unauthorized" });
        }

        const allowedKeys = new Set([
          "preferredName",
          "gender",
          "age",
          "weight",
          "targetWeight",
          "height",
          "bmi",
          "sleepHours",
          "waterDaily",
          "trainingLevel",
          "trainingEnvironment",
          "trainingDaysPerWeek",
          "workoutDays",
          "goal",
        ]);

        const payload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(req.body ?? {})) {
          if (allowedKeys.has(key) && value !== undefined) {
            payload[key] = value;
          }
        }

        const onboarding = await prisma.onboarding.upsert({
          where: { userId: session.user.id },
          update: payload,
          create: {
            ...payload,
            userId: session.user.id,
          },
        });

        const onboardingCompleted = !!(
          onboarding.goal &&
          onboarding.trainingLevel &&
          onboarding.trainingDaysPerWeek &&
          onboarding.gender
        );

        // --- Automatically map onboarding to a Program template ---
        if (onboardingCompleted) {
          console.log(
            `[Onboarding] Searching for matching program and generating plan for user ${session.user.id}`,
          );

          try {
            const planService = new PlanService();
            await planService.generatePlan(session.user.id);
            console.log("[Onboarding] Successfully generated plan for user.");
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.log(`[Onboarding] Plan generation failed: ${message}`);
          }
        }

        return res.json({ ok: true, onboardingCompleted });
      } catch {
        return res
          .status(400)
          .json({ ok: false, message: "Failed to complete onboarding" });
      }
    },
  );

  // 4. Better-Auth handler
  const { toNodeHandler } = await import("better-auth/node");

  expressApp.use(
    "/api/auth",
    (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      const path = req.originalUrl || req.url;
      const isSignIn = path.includes("/sign-in");
      const isSignOut = path.includes("/sign-out");

      res.on("finish", () => {
        if (!isSignIn && !isSignOut) return;

        const event = isSignIn ? "sign_in" : "sign_out";
        const outcome = res.statusCode >= 400 ? "failure" : "success";
        const userAgent =
          typeof req.headers?.["user-agent"] === "string"
            ? req.headers["user-agent"]
            : "unknown";

        logAuthAudit(event, {
          outcome,
          method: req.method,
          path,
          statusCode: res.statusCode,
          durationMs: Date.now() - start,
          ip: req.ip,
          userAgent,
        });
      });

      next();
    },
  );

  expressApp.all("/api/auth/*path", (req: Request, res: Response) => {
    return toNodeHandler(auth)(req, res);
  });

  // 4. tRPC handler
  const { createExpressMiddleware } = await import(
    "@trpc/server/adapters/express"
  );
  const { appRouter } = await import("@kora/api/routers/index");
  const { createContext } = await import("@kora/api/context");
  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // 5. Serve static test files
  app.use(express.static(path.join(__dirname, "../public")));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server is running on http://localhost:${port}`);
}
if (process.env.NODE_ENV === "production" && cluster.isPrimary) {
  console.log(`Primary process ${process.pid} is running`);

  ensureProgramTemplates()
    .then(() => {
      const workers =
        parseInt(process.env.WEB_CONCURRENCY || "", 10) ||
        os.cpus().length ||
        1;
      console.log(`Forking ${workers} workers...`);

      for (let i = 0; i < workers; i++) {
        cluster.fork();
      }

      cluster.on("exit", (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
      });
    })
    .catch((err) => {
      console.error("[Startup] Primary seed failed:", err);
      process.exit(1);
    });
} else {
  // Run seed here only if we are not a worker (i.e. dev mode)
  if (!cluster.isWorker) {
    ensureProgramTemplates().catch((err) =>
      console.error("[Startup] Seeding failed:", err),
    );
  }

  bootstrap().catch((err) => {
    console.error("Error during bootstrap:", err);
    process.exit(1);
  });
}
