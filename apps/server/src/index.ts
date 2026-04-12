import "reflect-metadata";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auth } from "@kora/auth";
import prisma, {
  type ExperienceLevel,
  type Gender,
  type TrainingGoal,
} from "@kora/db";
import { env } from "@kora/env/server";
import { NestFactory } from "@nestjs/core";

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

  // Automatically seed program templates if missing (moved out of sync block)
  ensureProgramTemplates().catch((err) =>
    console.error("[Startup] Seeding failed:", err),
  );

  app.enableCors({
    origin: (origin, callback) => {
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
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    credentials: true,
  });

  const expressApp = app.getHttpAdapter().getInstance();

  // 1. Manually add body parsing early
  const { default: express } = await import("express");
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
      if (req.method === "POST" && req.url.includes("/trpc/")) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        console.log(
          "[REQ BODY]",
          JSON.stringify(redactSensitiveFields(req.body)),
        );
      }
      next();
    },
  );

  // 3. Health check endpoints
  expressApp.get(
    "/api/health/auth",
    async (
      req: { headers: any },
      res: {
        json: (data: any) => void;
        status: (code: number) => { json: (data: any) => void };
      },
    ) => {
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
    },
  );

  // 3a. Connectivity Test Endpoint
  expressApp.post("/api/test-post", (req: any, res: any) => {
    res.json({
      ok: true,
      message: "POST received successfully",
      echo: req.body,
    });
  });

  // 3b. Onboarding status for route gating on mobile/web clients
  expressApp.get("/api/onboarding/status", async (req: any, res: any) => {
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
  });

  // 3c. Complete onboarding with explicit field allowlist
  expressApp.post("/api/onboarding/complete", async (req: any, res: any) => {
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
        const existingPlan = await prisma.userPlan.findFirst({
          where: { userId: session.user.id },
        });

        if (!existingPlan) {
          console.log(
            `[Onboarding] Searching for matching program for user ${session.user.id}`,
          );

          // 1. Find matching program selection
          const selection = await prisma.programSelection.findUnique({
            where: {
              goal_level_daysPerWeek_gender: {
                goal: onboarding.goal as TrainingGoal,
                level: onboarding.trainingLevel as ExperienceLevel,
                daysPerWeek: onboarding.trainingDaysPerWeek as number,
                gender: onboarding.gender as Gender,
              },
            },
          });

          let programIdToUse = selection?.programId;

          // Fallback if no exact match exists in the seed matrix
          if (!programIdToUse) {
            const anyProgram = await prisma.program.findFirst();
            if (anyProgram) programIdToUse = anyProgram.id;
          }

          if (programIdToUse) {
            // Fetch the full program template
            const program = await prisma.program.findUnique({
              where: { id: programIdToUse },
              include: {
                phases: {
                  include: {
                    workouts: {
                      include: {
                        exercises: {
                          include: { exercise: true },
                          orderBy: { order: "asc" },
                        },
                      },
                      orderBy: { dayNumber: "asc" },
                    },
                  },
                  orderBy: { order: "asc" },
                },
              },
            });

            if (program && program.phases.length > 0) {
              const mainPhase = program.phases[0]!;

              // 2. Build weeks array based on durationWeeks
              const weeks = [];
              for (let w = 1; w <= program.durationWeeks; w++) {
                // Map templates to actual sessions
                const sessions = mainPhase.workouts.map((wt: any) => {
                  return {
                    dayNumber: wt.dayNumber,
                    name: wt.name,
                    rest: false,
                    exercises: wt.exercises.map((et: any) => ({
                      id: et.exercise.id,
                      exerciseId: et.exercise.id,
                      name: et.exercise.name,
                      gifUrl: et.exercise.gifUrl,
                      sets: et.sets,
                      reps: et.reps,
                      intensity: et.intensity,
                      restTime: et.restTime,
                    })),
                  };
                });

                weeks.push({
                  weekNumber: w,
                  sessions,
                });
              }

              await prisma.userPlan.create({
                data: {
                  userId: session.user.id,
                  programId: program.id,
                  startDate: new Date(),
                  planJson: {
                    programName: program.name,
                    weeks,
                  },
                },
              });
              console.log(
                `[Onboarding] Successfully attached program "${program.name}" to user.`,
              );
            } else {
              console.log(
                `[Onboarding] Could not find program data for ID: ${programIdToUse}`,
              );
            }
          }
        }
      }

      return res.json({ ok: true, onboardingCompleted });
    } catch {
      return res
        .status(400)
        .json({ ok: false, message: "Failed to complete onboarding" });
    }
  });

  // 4. Better-Auth handler
  const { toNodeHandler } = await import("better-auth/node");

  expressApp.use("/api/auth", (req: any, res: any, next: any) => {
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
  });

  expressApp.all("/api/auth/*path", (req: any, res: any) => {
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

bootstrap();
