import { env } from "@kora/env/server";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AnalyticsModule } from "./analytics/analytics.module";
import { HealthModule } from "./health/health.module";
import { S3TestModule } from "./s3-test/s3-test.module";
import { SyncModule } from "./sync/sync.module";

@Module({
  imports: [
    HealthModule,
    SyncModule,
    AnalyticsModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: "short",
          ttl: 1000,
          limit: 3,
        },
        {
          name: "medium",
          ttl: 60000,
          limit: 60,
        },
        {
          name: "long",
          ttl: 3600000,
          limit: 1000,
        },
      ],
      storage: new ThrottlerStorageRedisService({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      }),
    }),
    S3TestModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
