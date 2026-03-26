import "reflect-metadata";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auth } from "@kora/auth";
import { env } from "@kora/env/server";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.enableCors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  const expressApp = app.getHttpAdapter().getInstance();

  // 1. Manually add body parsing early
  const { default: express } = await import("express");
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 2. Debug Logger (after body parsing)
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'POST' && req.url.includes('/trpc/')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      console.log(`[REQ BODY]`, JSON.stringify(req.body));
    }
    next();
  });

  // 3. Better-Auth handler
  const { toNodeHandler } = await import("better-auth/node");
  expressApp.all("/api/auth/*path", toNodeHandler(auth));

  // 4. tRPC handler
  const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
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
