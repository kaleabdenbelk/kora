/**
 * heatmap-test.ts
 *
 * Simulates a realistic month of workout activity for a user, then calls
 * getActivityHeatmap and renders the result as a colour-coded calendar
 * grid in the terminal so you can visually verify the logic is sound.
 *
 * Usage:
 *   npx tsx scripts/heatmap-test.ts <userEmail>
 *
 * The script:
 *  1. Finds the user by email.
 *  2. Seeds 30 days of fake completed sessions (3×/week cadence with random
 *     missed days and one back-to-back double-session day to test counting).
 *  3. Calls AnalyticsService.getActivityHeatmap() for the last 30 days.
 *  4. Renders a month calendar with colour-coded tiles and a legend.
 *  5. Cleans up the seeded sessions so it is safe to run repeatedly.
 */

import prisma from "../packages/db/src/index.js";
import { AnalyticsService } from "../packages/api/src/services/analytics.service.js";

// ── ANSI colour helpers ──────────────────────────────────────────────────────
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const GREEN  = "\x1b[42m\x1b[30m";   // bg green  – worked out (1 session)
const YELLOW = "\x1b[43m\x1b[30m";   // bg yellow – double session
const RED    = "\x1b[41m\x1b[37m";   // bg red    – missed (was a planned day)
const GREY   = "\x1b[100m\x1b[37m";  // bg grey   – rest day

function colorTile(label: string, color: string) {
  return `${color} ${label} ${RESET}`;
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

// ── Workout schedule simulation ──────────────────────────────────────────────
/**
 * Build a simple 3×/week schedule (Mon / Wed / Fri) for the last 30 days.
 * We also randomly drop some planned days (missed workouts) and add one
 * double-session to stress-test the session-count logic in the heatmap.
 */
function buildSchedule(today: Date): {
  plannedDays: Set<string>;
  workedOutDays: Map<string, number>; // date → session count
} {
  const plannedDays = new Set<string>();
  const workedOutDays = new Map<string, number>();

  // Mark Mon/Wed/Fri as planned over last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    const dow = d.getDay(); // 0=Sun … 6=Sat
    if (dow === 1 || dow === 3 || dow === 5) {
      plannedDays.add(toDateStr(d));
    }
  }

  // Simulate attendance: miss ~2 planned days, add one double-session
  const planned = Array.from(plannedDays);
  const missIdx = new Set([2, 7]); // skip indices 2 and 7

  planned.forEach((dateStr, idx) => {
    if (missIdx.has(idx)) return; // missed workout
    // Double session on index 4 to verify count > 1 in heatmap
    const count = idx === 4 ? 2 : 1;
    workedOutDays.set(dateStr, count);
  });

  return { plannedDays, workedOutDays };
}

// ── Calendar renderer ────────────────────────────────────────────────────────
function renderCalendar(
  today: Date,
  planned: Set<string>,
  heatmap: Record<string, number>,
): void {
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Build the 30-day window
  const start = addDays(today, -29);

  // Print header
  console.log(`\n${BOLD}  ── Activity Heatmap — last 30 days ──${RESET}\n`);
  console.log("  " + DAYS.map((d) => `${DIM}${d}${RESET}`).join("  "));

  // Pad to the first day of the week
  const firstDow = start.getDay();
  let line = "  " + "     ".repeat(firstDow);

  for (let i = 0; i < 30; i++) {
    const d = addDays(start, i);
    const ds = toDateStr(d);
    const count = heatmap[ds] ?? 0;
    const isPlanned = planned.has(ds);
    const dayLabel = String(d.getDate()).padStart(2, " ");

    let tile: string;
    if (count >= 2) {
      tile = colorTile(dayLabel, YELLOW); // double session
    } else if (count === 1) {
      tile = colorTile(dayLabel, GREEN);  // normal workout
    } else if (isPlanned) {
      tile = colorTile(dayLabel, RED);    // planned but missed
    } else {
      tile = colorTile(dayLabel, GREY);   // rest day
    }

    line += tile + "  ";

    // New row after Saturday
    if (d.getDay() === 6) {
      console.log(line);
      line = "  ";
    }
  }
  if (line.trim()) console.log(line);

  // Legend
  console.log(`
  Legend:
    ${colorTile("##", GREEN)}  Worked out (1 session)
    ${colorTile("##", YELLOW)}  Double session (2+ sessions)
    ${colorTile("##", RED)}  Missed planned workout
    ${colorTile("##", GREY)}  Rest / unplanned day
  `);
}

// ── Seed helpers ─────────────────────────────────────────────────────────────
async function seedSessions(
  userId: string,
  planId: string,
  workedOutDays: Map<string, number>,
): Promise<string[]> {
  const ids: string[] = [];

  for (const [dateStr, count] of workedOutDays.entries()) {
    const completedAt = new Date(`${dateStr}T10:00:00Z`);

    for (let i = 0; i < count; i++) {
      const s = await prisma.userSession.create({
        data: {
          userId,
          planId,
          dayNumber: 1,
          week: 1,
          planned: { name: "Heatmap Test Session" },
          completedStatus: true,
          completedAt,
          startedAt: new Date(completedAt.getTime() - 45 * 60_000),
          totalDurationSeconds: 2700,
        },
      });
      ids.push(s.id);
    }
  }

  return ids;
}

async function cleanupSessions(ids: string[]): Promise<void> {
  await prisma.userSession.deleteMany({ where: { id: { in: ids } } });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/heatmap-test.ts <userEmail>");
    process.exit(1);
  }

  // 1. Find user + their first plan (needed for FK)
  const user = await prisma.user.findUnique({
    where: { email },
    include: { userPlans: { take: 1 } },
  });

  if (!user) {
    console.error(`User "${email}" not found.`);
    process.exit(1);
  }

  const plan = user.userPlans[0];
  if (!plan) {
    console.error(
      `User "${email}" has no UserPlan. Generate a plan first so the FK exists.`,
    );
    process.exit(1);
  }

  const today = new Date();
  today.setHours(23, 59, 59, 0);

  // 2. Build schedule
  const { plannedDays, workedOutDays } = buildSchedule(today);

  console.log(`\nSeeding ${workedOutDays.size} workout days for ${user.name ?? email}...`);
  const seededIds = await seedSessions(user.id, plan.id, workedOutDays);
  console.log(`  ✓ Created ${seededIds.length} session(s).`);

  // 3. Call the real heatmap service
  const analytics = new AnalyticsService();
  const heatmap = await analytics.getActivityHeatmap(user.id, 30);

  // 4. Summarise
  const totalWorkoutDays = Object.keys(heatmap).length;
  const totalSessions = Object.values(heatmap).reduce((a, b) => a + b, 0);
  const missedDays = [...plannedDays].filter((d) => !heatmap[d]).length;

  console.log(`\nHeatmap result (${totalWorkoutDays} active days, ${totalSessions} sessions, ${missedDays} missed planned days):`);
  console.log(JSON.stringify(heatmap, null, 2));

  // 5. Render calendar
  renderCalendar(today, plannedDays, heatmap);

  // 6. Clean up seeded data
  console.log("Cleaning up seeded sessions...");
  await cleanupSessions(seededIds);
  console.log("  ✓ Done. Database is clean.\n");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
