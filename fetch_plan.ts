import * as fs from "node:fs";
import * as path from "node:path";
import prisma from "./packages/db/src/index.ts";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "kaleabdenbel1921@gmail.com" },
    include: {
      userPlans: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sessions: {
            orderBy: [{ week: "asc" }, { dayNumber: "asc" }],
          },
        },
      },
    },
  });

  if (!user || user.userPlans.length === 0) {
    console.log("No plan found for kaleabdenbel@gmail.com");
    return;
  }

  const plan = user.userPlans[0];
  const sessions = plan.sessions;

  let markdown = "# Workout Plan for kaleabdenbel1921@gmail.com\n\n";

  interface PlanJson {
    programName?: string;
  }
  const planJson = plan.planJson as unknown as PlanJson;
  markdown += `**Program Name**: ${planJson?.programName || "Unknown Program"}\n`;
  markdown += `**Start Date**: ${plan.startDate}\n`;
  markdown += `**End Date**: ${plan.endDate}\n\n`;

  let currentWeek = -1;

  for (const session of sessions) {
    if (session.week !== currentWeek) {
      currentWeek = session.week as number;
      markdown += `## Week ${currentWeek}\n\n`;
    }

    interface PlannedSession {
      name?: string;
      exercises?: Array<{
        name: string;
        sets: number;
        reps: string;
        restTime: number;
        intensity?: string;
      }>;
    }
    const planned = session.planned as unknown as PlannedSession;

    markdown += `### Day ${session.dayNumber}: ${planned?.name || "Workout"}\n`;
    if (planned?.exercises && planned.exercises.length > 0) {
      markdown += "| Exercise | Sets | Reps | Rest | Intensity |\n";
      markdown += "|---|---|---|---|---|\n";
      for (const ex of planned.exercises) {
        markdown += `| ${ex.name} | ${ex.sets} | ${ex.reps} | ${ex.restTime}s | ${ex.intensity || "-"} |\n`;
      }
    } else {
      markdown += "*Rest day or no exercises planned.*\n";
    }
    markdown += "\n";
  }

  const outPath = path.resolve("kaleab1921s_plan.md");
  fs.writeFileSync(outPath, markdown);
  console.log(`Plan written to ${outPath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
