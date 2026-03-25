import "reflect-metadata";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auth } from "@kora/auth";
import { env } from "@kora/env/server";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  const expressApp = app.getHttpAdapter().getInstance();

  // Serve static test files from public/
  const { default: expressStatic } = await import("express");
  expressApp.use(expressStatic.static(path.join(__dirname, "../public")));

  expressApp.all("/api/auth/*path", async (req: unknown, _res: unknown) => {
    return auth.handler(req as Request);
  });

  await app.listen(3000);
  console.log("Server is running on http://localhost:3000");
}

bootstrap();
