import { auth } from "@kora/auth";
import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AnalyticsService } from "./analytics.service";

@Controller("api/analytics")
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Auth-scoped routes (used by Expo frontend — no userId in URL)
  // userId is derived from the Better Auth session token.
  // ─────────────────────────────────────────────────────────────────────────────

  private async resolveUserId(req: Request): Promise<string> {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id)
      throw new UnauthorizedException("Authentication required");
    return session.user.id;
  }

  /** GET /analytics/summary?filter=Week */
  @Get("summary")
  async getSummary(@Req() req: Request, @Query("filter") filter = "Week") {
    const userId = await this.resolveUserId(req);
    const data = await this.analyticsService.getSummary(userId, filter);
    return { success: true, data: { summary: data } };
  }

  /** GET /analytics/heatmap?days=180 */
  @Get("heatmap")
  async getHeatmap(@Req() req: Request, @Query("days") days = "180") {
    const userId = await this.resolveUserId(req);
    const data = await this.analyticsService.getActivityHeatmap(
      userId,
      Number(days),
    );
    // Frontend expects HeatmapData[] array: [{ date, count }]
    const formatted = Object.entries(data).map(([date, count]) => ({
      date,
      count,
    }));
    return { success: true, data: { data: formatted } };
  }

  /** GET /analytics/muscles?filter=Month */
  @Get("muscles")
  async getMuscles(@Req() req: Request, @Query("filter") filter = "Month") {
    const userId = await this.resolveUserId(req);
    const days = { Day: 1, Week: 7, Month: 30, Year: 365 }[filter] ?? 30;
    const distribution = await this.analyticsService.getMuscleDistribution(
      userId,
      days,
    );
    return { success: true, data: { distribution } };
  }

  /** GET /analytics/trends?metric=Tonnage&filter=Week */
  @Get("trends")
  async getTrends(
    @Query("metric") metric,
    @Query("filter") filter,
    @Req() req: Request,
  ) {
    const userId = await this.resolveUserId(req);
    const data = await this.analyticsService.getTrends(userId, metric, filter);
    return { success: true, data };
  }

  /** GET /analytics/streak */
  @Get("streak")
  async getStreak(@Req() req: Request) {
    const userId = await this.resolveUserId(req);
    const data = await this.analyticsService.getStreakData(userId);
    return { success: true, data };
  }

  /** GET /analytics/last-workout */
  @Get("last-workout")
  async getLastWorkout(@Req() req: Request) {
    const userId = await this.resolveUserId(req);
    const workout = await this.analyticsService.getLastWorkout(userId);
    return { success: true, data: { workout } };
  }

  /** GET /analytics/profile-summary */
  @Get("profile-summary")
  async getProfileSummary(@Req() req: Request) {
    const userId = await this.resolveUserId(req);
    const data = await this.analyticsService.getProfileSummary(userId);
    return { success: true, data };
  }

  /** GET /analytics/history?limit=20&offset=0 */
  @Get("history")
  async getHistory(
    @Query("limit") limit,
    @Query("offset") offset,
    @Req() req: Request,
  ) {
    const userId = await this.resolveUserId(req);
    const page = Math.floor(Number(offset) / Number(limit)) + 1;
    const history = await this.analyticsService.getWorkoutHistory(
      userId,
      page,
      Number(limit),
    );
    return { success: true, data: { history: history.sessions } };
  }

  /** GET /analytics/personal-records */
  @Get("personal-records")
  async getPersonalRecords(@Req() req: Request) {
    const userId = await this.resolveUserId(req);
    const records = await this.analyticsService.getPersonalRecords(userId);
    return { success: true, data: { records } };
  }

  /** GET /analytics/daily-activity */
  @Get("daily-activity")
  async getDailyActivity(@Req() req: Request) {
    const userId = await this.resolveUserId(req);
    const activities =
      await this.analyticsService.getVirtualDailyActivity(userId);
    return { success: true, data: { activities } };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin/internal routes (userId in URL — used by tests and internal tooling)
  // ─────────────────────────────────────────────────────────────────────────────

  /** GET /analytics/:userId/dashboard */
  @Get(":userId/dashboard")
  async getDashboard(@Param("userId") userId: string, @Req() req: Request) {
    const authId = await this.resolveUserId(req);
    if (authId !== userId) throw new UnauthorizedException();
    return this.analyticsService.getDashboardStats(userId);
  }

  /** GET /analytics/:userId/heatmap?days=365 */
  @Get(":userId/heatmap")
  async getHeatmapById(
    @Req() req: Request,
    @Param("userId") userId: string,
    @Query("days") days?: string,
  ) {
    const authId = await this.resolveUserId(req);
    if (authId !== userId) throw new UnauthorizedException();
    return this.analyticsService.getActivityHeatmap(
      userId,
      days ? Number(days) : 365,
    );
  }

  /** GET /analytics/:userId/muscle-distribution?days=30 */
  @Get(":userId/muscle-distribution")
  async getMuscleDistribution(
    @Req() req: Request,
    @Param("userId") userId: string,
    @Query("days") days?: string,
  ) {
    const authId = await this.resolveUserId(req);
    if (authId !== userId) throw new UnauthorizedException();
    return this.analyticsService.getMuscleDistribution(
      userId,
      days ? Number(days) : 30,
    );
  }

  /** GET /analytics/:userId/workout-focus?days=30 */
  @Get(":userId/workout-focus")
  async getWorkoutFocus(
    @Req() req: Request,
    @Param("userId") userId: string,
    @Query("days") days?: string,
  ) {
    const authId = await this.resolveUserId(req);
    if (authId !== userId) throw new UnauthorizedException();
    return this.analyticsService.getWorkoutFocusBreakdown(
      userId,
      days ? Number(days) : 30,
    );
  }

  /** POST /analytics/:userId/recalculate-metabolic */
  @Post(":userId/recalculate-metabolic")
  async recalculateMetabolic(
    @Param("userId") userId: string,
    @Req() req: Request,
  ) {
    const authId = await this.resolveUserId(req);
    if (authId !== userId) throw new UnauthorizedException();
    return this.analyticsService.recalculateAndSaveMetabolicRates(userId);
  }

  /** GET /analytics/:userId/personal-records */
  @Get(":userId/personal-records")
  async getPersonalRecordsById(
    @Param("userId") userId: string,
    @Req() req: Request,
  ) {
    const authId = await this.resolveUserId(req);
    if (authId !== userId) throw new UnauthorizedException();
    const records = await this.analyticsService.getPersonalRecords(userId);
    return { success: true, data: { records } };
  }

  /** GET /analytics/:userId/caloric-history */
  @Get(":userId/caloric-history")
  async getCaloricHistory(
    @Param("userId") userId: string,
    @Req() req: Request,
  ) {
    const authId = await this.resolveUserId(req);
    if (authId !== userId) throw new UnauthorizedException();
    const logs = await this.analyticsService.getCaloricHistory(userId);
    return { success: true, data: { logs } };
  }

  /** GET /analytics/:userId/history?page=1&limit=10 */
  @Get(":userId/history")
  async getWorkoutHistory(
    @Req() req: Request,
    @Param("userId") userId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const authId = await this.resolveUserId(req);
    if (authId !== userId) throw new UnauthorizedException();
    const history = await this.analyticsService.getWorkoutHistory(
      userId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
    return { success: true, data: history };
  }
}
