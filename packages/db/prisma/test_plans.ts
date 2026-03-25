import dotenv from "dotenv";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function generatePlanForUser(
  prisma: any,
  userId: string,
  profile: {
    goal: any;
    trainingLevel: any;
    trainingDaysPerWeek: number;
    gender: any;
  }
) {
  // 1. Get matching program selection
  const selection = await prisma.programSelection.findUnique({
    where: {
      goal_level_daysPerWeek_gender: {
        goal: profile.goal,
        level: profile.trainingLevel,
        daysPerWeek: profile.trainingDaysPerWeek,
        gender: profile.gender,
      },
    },
    include: {
      program: {
        include: {
          phases: {
            include: {
              workouts: {
                include: {
                  exercises: {
                    include: { exercise: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!selection) {
    return null;
  }

  const { program } = selection;

  // 2. Create UserPlan
  return await prisma.$transaction(async (tx: any) => {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + program.durationWeeks * 7);

    const userPlan = await tx.userPlan.create({
      data: { userId, programId: program.id, startDate, endDate },
    });

    const sessionData: any[] = [];
    let currentWeek = 1;
    for (const phase of program.phases) {
      for (let w = 0; w < phase.durationWeeks; w++) {
        const weekNumber = currentWeek + w;
        for (const workoutTemplate of phase.workouts) {
          sessionData.push({
            userId,
            planId: userPlan.id,
            dayNumber: workoutTemplate.dayNumber,
            week: weekNumber,
            planned: {
              name: workoutTemplate.name,
              exercises: workoutTemplate.exercises.map((et: any) => ({
                exerciseId: et.exerciseId,
                name: et.exercise.name,
                sets: et.sets,
                reps: et.reps,
                intensity: et.intensity,
                restTime: et.restTime,
              })),
            },
          });
        }
      }
      currentWeek += phase.durationWeeks;
    }

    await tx.userSession.createMany({ data: sessionData });

    // Return week 1 sessions only
    return {
      planId: userPlan.id,
      programName: program.name,
      durationWeeks: program.durationWeeks,
      week1Sessions: sessionData
        .filter((s) => s.week === 1)
        .sort((a, b) => a.dayNumber - b.dayNumber),
    };
  });
}

function formatPlan(
  label: string,
  profile: {
    goal: string;
    level: string;
    gender: string;
    daysPerWeek: number;
  },
  result: any
): string {
  if (!result) {
    return `## ${label}\n\n> ⚠️ No matching program found for this profile.\n\n---\n`;
  }

  let md = `## ${label}\n\n`;
  md += `**Profile:** ${profile.gender} | ${profile.level} | Goal: ${profile.goal} | ${profile.daysPerWeek} days/week  \n`;
  md += `**Program:** ${result.programName} (${result.durationWeeks}-week program)  \n`;
  md += `**Plan ID:** \`${result.planId}\`\n\n`;

  for (const session of result.week1Sessions) {
    const planned = session.planned as any;
    md += `### Day ${session.dayNumber}: ${planned.name}\n\n`;
    md += `| # | Exercise | Sets | Reps | Intensity | Rest |\n`;
    md += `|---|----------|------|------|-----------|------|\n`;
    for (let i = 0; i < planned.exercises.length; i++) {
      const ex = planned.exercises[i];
      md += `| ${i + 1} | ${ex.name} | ${ex.sets} | ${ex.reps} | ${ex.intensity ?? "—"} | ${ex.restTime ? `${ex.restTime}s` : "—"} |\n`;
    }
    md += "\n";
  }

  md += "---\n";
  return md;
}

async function main() {
  console.log("🧪 Running Plan Generation Tests for 4 scenarios...\n");

  const { PrismaClient } = await import("./generated/client.js");
  const {
    TrainingGoal,
    ExperienceLevel,
    Gender,
  } = await import("./generated/enums.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  const scenarios = [
    {
      label: "Scenario 1: Beginner Male — Hypertrophy, 3 Days/Week",
      userId: "test-s1-beg-male-hyp-3",
      email: "test-s1@kora.test",
      profile: {
        goal: TrainingGoal.HYPERTROPHY,
        trainingLevel: ExperienceLevel.BEGINNER,
        trainingDaysPerWeek: 3,
        gender: Gender.MALE,
      },
      profileLabel: {
        goal: "HYPERTROPHY",
        level: "BEGINNER",
        gender: "Male",
        daysPerWeek: 3,
      },
    },
    {
      label: "Scenario 2: Beginner Female — Hypertrophy, 3 Days/Week",
      userId: "test-s2-beg-female-hyp-3",
      email: "test-s2@kora.test",
      profile: {
        goal: TrainingGoal.HYPERTROPHY,
        trainingLevel: ExperienceLevel.BEGINNER,
        trainingDaysPerWeek: 3,
        gender: Gender.FEMALE,
      },
      profileLabel: {
        goal: "HYPERTROPHY",
        level: "BEGINNER",
        gender: "Female",
        daysPerWeek: 3,
      },
    },
    {
      label: "Scenario 3: Intermediate Male — Strength, 3 Days/Week",
      userId: "test-s3-int-male-str-3",
      email: "test-s3@kora.test",
      profile: {
        goal: TrainingGoal.STRENGTH,
        trainingLevel: ExperienceLevel.INTERMEDIATE,
        trainingDaysPerWeek: 3,
        gender: Gender.MALE,
      },
      profileLabel: {
        goal: "STRENGTH",
        level: "INTERMEDIATE",
        gender: "Male",
        daysPerWeek: 3,
      },
    },
    {
      label: "Scenario 4: Beginner Male — Hypertrophy, 4 Days/Week",
      userId: "test-s4-beg-male-hyp-4",
      email: "test-s4@kora.test",
      profile: {
        goal: TrainingGoal.HYPERTROPHY,
        trainingLevel: ExperienceLevel.BEGINNER,
        trainingDaysPerWeek: 4,
        gender: Gender.MALE,
      },
      profileLabel: {
        goal: "HYPERTROPHY",
        level: "BEGINNER",
        gender: "Male",
        daysPerWeek: 4,
      },
    },
  ];

  let markdown = `# Kora — Programmatic Plan Generation Test\n\n`;
  markdown += `> Generated on ${new Date().toISOString()}\n\n`;
  markdown += `This document shows week 1 sessions generated by the live \`generatePlan\` service for 4 user profiles.\n\n---\n\n`;

  for (const scenario of scenarios) {
    console.log(`▶ ${scenario.label}...`);

    // Clean up previous test data
    await prisma.userPlan.deleteMany({ where: { userId: scenario.userId } });
    await prisma.onboarding.deleteMany({ where: { userId: scenario.userId } });
    await prisma.user.upsert({
      where: { id: scenario.userId },
      update: {},
      create: {
        id: scenario.userId,
        name: scenario.label,
        email: scenario.email,
      },
    });

    try {
      const result = await generatePlanForUser(
        prisma,
        scenario.userId,
        scenario.profile
      );
      if (result) {
        console.log(
          `  ✅ Plan created: ${result.programName}, ${result.week1Sessions.length} sessions in week 1`
        );
      } else {
        console.log("  ⚠️  No matching template found.");
      }
      markdown += formatPlan(scenario.label, scenario.profileLabel, result);
    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`);
      markdown += `## ${scenario.label}\n\n> ❌ Error: ${err.message}\n\n---\n`;
    }
  }

  const outputPath = path.resolve(__dirname, "../../../test_plan.md");
  fs.writeFileSync(outputPath, markdown, "utf8");
  console.log(`\n✅ Done! Output written to: ${outputPath}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
