/**
 * Analytics Data Diagnostic Script
 * Usage: pnpm dlx tsx -r dotenv/config packages/db/src/test-analytics-data.ts
 *
 * Checks real DB data for: Heatmap, Time, Calories, Volume (Tonnage)
 */
import prisma from "./index";

const USER_ID = "0GFAoOd4be3UEZHuW324531V3eGX0V9f";

function section(title: string) {
  console.log("\n" + "═".repeat(50));
  console.log(`  ${title}`);
  console.log("═".repeat(50));
}

async function checkHeatmap() {
  section("1. HEATMAP DATA (Last 180 days)");
  const since = new Date(Date.now() - 180 * 86_400_000);

  const sessions = await prisma.userSession.findMany({
    where: {
      userId: USER_ID,
      completedStatus: true,
      completedAt: { gte: since },
      isDeleted: false,
    },
    orderBy: { completedAt: "asc" },
    select: { completedAt: true, totalVolumeKg: true },
  });

  if (sessions.length === 0) {
    console.log("⚠️  No completed sessions found. Heatmap will be empty.");
    return;
  }

  // Group by date
  const heatmap: Record<string, number> = {};
  for (const s of sessions) {
    const date = s.completedAt?.toISOString().split("T")[0] ?? "unknown";
    heatmap[date] = (heatmap[date] ?? 0) + 1;
  }

  console.log(`✅ Found ${sessions.length} sessions across ${Object.keys(heatmap).length} unique days:`);
  Object.entries(heatmap).forEach(([date, count]) => {
    console.log(`   ${date}: ${"🟦".repeat(count)} (${count} session${count > 1 ? "s" : ""})`);
  });
}

async function checkTime() {
  section("2. TIME DATA (Last 30 days)");
  const since = new Date(Date.now() - 30 * 86_400_000);

  const sessions = await prisma.userSession.findMany({
    where: {
      userId: USER_ID,
      completedStatus: true,
      completedAt: { gte: since },
      isDeleted: false,
    },
    orderBy: { completedAt: "asc" },
    select: { completedAt: true, totalDurationSeconds: true },
  });

  if (sessions.length === 0) {
    console.log("⚠️  No completed sessions found. Time chart will be empty.");
    return;
  }

  console.log(`✅ Found ${sessions.length} sessions:`);
  sessions.forEach((s) => {
    const date = s.completedAt?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const hours = s.totalDurationSeconds
      ? (Math.round(s.totalDurationSeconds / 360) / 10).toFixed(1)
      : "0.0";
    const minutes = s.totalDurationSeconds
      ? Math.round(s.totalDurationSeconds / 60)
      : 0;
    console.log(`   ${date}: ${hours}h (${minutes} min)`);
  });

  const totalSeconds = sessions.reduce((a, s) => a + (s.totalDurationSeconds ?? 0), 0);
  console.log(`\n   Total: ${Math.round(totalSeconds / 60)} min (${(totalSeconds / 3600).toFixed(1)}h)`);
}

async function checkCalories() {
  section("3. CALORIE DATA (Last 30 days)");
  const since = new Date(Date.now() - 30 * 86_400_000);

  const logs = await prisma.dailyCaloricLog.findMany({
    where: { userId: USER_ID, date: { gte: since } },
    orderBy: { date: "asc" },
  });

  if (logs.length === 0) {
    console.log("⚠️  No caloric logs found.");
    console.log("   → These are created when a session is completed via calculateCaloricBurn().");
    console.log("   → Make sure onboarding data (weight, height, age) is present.");
    return;
  }

  console.log(`✅ Found ${logs.length} caloric log entries:`);
  logs.forEach((l) => {
    const date = l.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    console.log(`   ${date}: ${Math.round(l.workoutBurn)} kcal workout burn | ${Math.round(l.basalBurn)} kcal BMR | Total: ${Math.round(l.totalBurn)} kcal`);
  });

  const totalWorkoutBurn = logs.reduce((a, l) => a + l.workoutBurn, 0);
  console.log(`\n   Total Workout Burn: ${Math.round(totalWorkoutBurn)} kcal`);
}

async function checkTonnage() {
  section("4. VOLUME / TONNAGE DATA (Last 30 days)");
  const since = new Date(Date.now() - 30 * 86_400_000);

  const sessions = await prisma.userSession.findMany({
    where: {
      userId: USER_ID,
      completedStatus: true,
      completedAt: { gte: since },
      isDeleted: false,
    },
    orderBy: { completedAt: "asc" },
    select: { completedAt: true, totalVolumeKg: true },
  });

  if (sessions.length === 0) {
    console.log("⚠️  No completed sessions found. Tonnage chart will be empty.");
    return;
  }

  console.log(`✅ Found ${sessions.length} sessions:`);
  sessions.forEach((s) => {
    const date = s.completedAt?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const vol = s.totalVolumeKg != null ? `${s.totalVolumeKg.toFixed(1)} kg` : "⚠️ null (not set)";
    console.log(`   ${date}: ${vol}`);
  });

  const totalTonnage = sessions.reduce((a, s) => a + (s.totalVolumeKg ?? 0), 0);
  console.log(`\n   Total Tonnage: ${totalTonnage.toFixed(1)} kg`);
  console.log(`   Sessions with null volume: ${sessions.filter(s => s.totalVolumeKg == null).length}`);
}

async function checkOnboarding() {
  section("0. USER ONBOARDING CHECK");
  const onboarding = await prisma.onboarding.findUnique({ where: { userId: USER_ID } });
  if (!onboarding) {
    console.log("❌ No onboarding record found! Caloric burn calculations will fail.");
    return;
  }
  console.log(`✅ Onboarding found:`);
  console.log(`   Gender: ${onboarding.gender ?? "❌ null"}`);
  console.log(`   Weight: ${onboarding.weight ?? "❌ null"} kg`);
  console.log(`   Height: ${onboarding.height ?? "❌ null"} cm`);
  console.log(`   Age:    ${onboarding.age ?? "❌ null"}`);
  console.log(`   BMR:    ${onboarding.bmr ?? "❌ null"} kcal/day`);
  console.log(`   TDEE:   ${onboarding.tdee ?? "❌ null"} kcal/day`);

  if (!onboarding.bmr || !onboarding.tdee) {
    console.log("\n💡 TIP: Run 'pnpm dlx tsx -e \"import { AnalyticsService } from './packages/api/src/services/analytics.service'; new AnalyticsService().recalculateAndSaveMetabolicRates('${USER_ID}')\"' to fix BMR/TDEE.");
  }
}

async function main() {
  console.log("\n🔬 Kora Analytics Data Diagnostic");
  console.log(`   User: ${USER_ID}`);
  await checkOnboarding();
  await checkHeatmap();
  await checkTime();
  await checkCalories();
  await checkTonnage();
  console.log("\n✅ Diagnostic complete.\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
