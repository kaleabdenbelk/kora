import { ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";
import { GetSendQuotaCommand, SESClient } from "@aws-sdk/client-ses";
import prisma from "@kora/db";
import { env } from "@kora/env/server";
import type { OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { Redis } from "ioredis";

@Injectable()
export class HealthService implements OnModuleInit {
  private readonly logger = new Logger("HealthStatus");

  async onModuleInit() {
    this.logger.log("🚀 Starting System Health Checks...");

    await this.checkDatabase();
    await this.checkRedis();
    await this.checkAWS();

    this.logger.log("✨ All Health Checks Completed!");
  }

  private async checkDatabase() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      this.logger.log("✅ Postgres: Connected (kora_dev)");
    } catch (error: unknown) {
      this.logger.error("❌ Postgres: Connection Failed", error instanceof Error ? error.message : String(error));
    }
  }

  private async checkRedis() {
    const redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      await redis.ping();
      this.logger.log(
        `✅ Redis: Connected (${env.REDIS_HOST}:${env.REDIS_PORT})`,
      );
      await redis.quit();
    } catch (error: unknown) {
      this.logger.error(
        `❌ Redis: Connection Failed (${env.REDIS_HOST}:${env.REDIS_PORT})`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async checkAWS() {
    // 1. S3/MinIO
    const s3 = new S3Client({
      endpoint: env.AWS_S3_ENDPOINT,
      region: env.AWS_S3_REGION,
      credentials: {
        accessKeyId: env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    try {
      await s3.send(new ListBucketsCommand({}));
      this.logger.log(`✅ AWS S3: Connected (${env.AWS_S3_BUCKET_NAME})`);
    } catch (error: unknown) {
      this.logger.error("❌ AWS S3: Connection Failed", error instanceof Error ? error.message : String(error));
    }

    // 2. SES
    const ses = new SESClient({
      region: env.AWS_S3_REGION, // Usually same region or specific
      credentials: {
        accessKeyId: env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_S3_SECRET_ACCESS_KEY,
      },
    });

    try {
      await ses.send(new GetSendQuotaCommand({}));
      this.logger.log("✅ AWS SES: Ready");
    } catch (_error) {
      // In local dev without real SES keys, this might fail, which is often expected
      this.logger.warn(
        "⚠️ AWS SES: Skipping or Not Configured (Expected in local dev)",
      );
    }
  }
}
