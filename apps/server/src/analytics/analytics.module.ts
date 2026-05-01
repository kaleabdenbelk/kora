import { AnalyticsService } from "@kora/api/services/analytics.service";
import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
