import "reflect-metadata";
import { auth } from "@kora/auth";
import { env } from "@kora/env/server";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.all("/api/auth/*path", async (req: any, _res: any) => {
    return auth.handler(req);
  });

  await app.listen(3000);
  console.log("Server is running on http://localhost:3000");
}

bootstrap();
