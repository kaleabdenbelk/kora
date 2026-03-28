import prisma from "./packages/db/src/index.ts";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'kaleabdenbel@gmail.com' },
    include: {
      userPlans: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          sessions: {
            orderBy: [{ week: 'asc' }, { dayNumber: 'asc' }]
          }
        }
      }
    }
  });

  if (!user || user.userPlans.length === 0) {
    console.log("No plan found for kaleabdenbel@gmail.com");
    return;
  }

  const plan = user.userPlans[0];
  const sessions = plan.sessions;

  let markdown = `# Workout Plan for kaleabdenbel@gmail.com\n\n`;
  
  // Cast planJson to any to avoid type issues if it's stored as JsonValue
  const planJson = plan.planJson as any;
  markdown += `**Program Name**: ${planJson?.programName || 'Unknown Program'}\n`;
  markdown += `**Start Date**: ${plan.startDate}\n`;
  markdown += `**End Date**: ${plan.endDate}\n\n`;

  let currentWeek = -1;

  for (const session of sessions) {
    if (session.week !== currentWeek) {
      currentWeek = session.week as number;
      markdown += `## Week ${currentWeek}\n\n`;
    }
    
    // cast planned to any to access properties safely
    const planned = session.planned as any;
    
    markdown += `### Day ${session.dayNumber}: ${planned?.name || 'Workout'}\n`;
    if (planned?.exercises && planned.exercises.length > 0) {
      markdown += `| Exercise | Sets | Reps | Rest | Intensity |\n`;
      markdown += `|---|---|---|---|---|\n`;
      for (const ex of planned.exercises) {
        markdown += `| ${ex.name} | ${ex.sets} | ${ex.reps} | ${ex.restTime}s | ${ex.intensity || '-'} |\n`;
      }
    } else {
      markdown += `*Rest day or no exercises planned.*\n`;
    }
    markdown += `\n`;
  }

  const outPath = path.resolve('kaleabs_plan.md');
  fs.writeFileSync(outPath, markdown);
  console.log(`Plan written to ${outPath}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
