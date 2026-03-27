import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prisma, { ExperienceLevel, Gender, TrainingGoal } from "@kora/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.join(__dirname, "../../public/seeds/Ready_Kora.json");

export async function ensureProgramTemplates() {
  console.log("[SeedUtil] Checking program templates...");

  try {
    const count = await prisma.programSelection.count();
    if (count > 0) {
      console.log(
        `[SeedUtil] Database already has ${count} selections. Skipping auto-seed.`,
      );
      return;
    }

    console.log(
      "[SeedUtil] Database is empty. Starting auto-seed from Ready_Kora.json...",
    );

    if (!fs.existsSync(SEED_FILE)) {
      console.warn(`[SeedUtil] Seed file not found at ${SEED_FILE}. Skipping.`);
      return;
    }

    const rawData = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
    const plans = rawData.plans;

    const goalMap: Record<string, TrainingGoal> = {
      hypertrophy: TrainingGoal.HYPERTROPHY,
      strength: TrainingGoal.STRENGTH,
      powerbuilding: TrainingGoal.POWERBUILDING,
      fat_loss: TrainingGoal.FAT_LOSS,
      maintenance: TrainingGoal.MAINTENANCE,
    };

    const levelMap: Record<string, ExperienceLevel> = {
      beginner: ExperienceLevel.BEGINNER,
      intermediate: ExperienceLevel.INTERMEDIATE,
      advanced: ExperienceLevel.ADVANCED,
    };

    const genderMap: Record<string, Gender> = {
      male: Gender.MALE,
      female: Gender.FEMALE,
    };

    for (const plan of plans) {
      const goal = goalMap[plan.goal] || TrainingGoal.HYPERTROPHY;
      const level = levelMap[plan.level] || ExperienceLevel.BEGINNER;
      const gender = genderMap[plan.gender] || Gender.MALE;

      // Simplified program creation for auto-seed
      const program = await prisma.program.upsert({
        where: { id: plan.plan_id },
        update: {},
        create: {
          id: plan.plan_id,
          name: plan.plan_id
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l: string) => l.toUpperCase()),
          goal,
          level,
          durationWeeks: 6,
          phases: {
            create: {
              name: "Main Phase",
              order: 1,
              durationWeeks: 6,
              workouts: {
                create: plan.week_1.map(
                  (w: { name: string; day: number; exercises: any[] }) => ({
                    name: w.name,
                    dayNumber: w.day,
                    exercises: {
                      create: w.exercises.map(
                        (
                          ex: {
                            id: string | number;
                            sets: number;
                            reps: string | number;
                            weight?: number;
                            rest?: number;
                          },
                          idx: number,
                        ) => ({
                          exerciseId: String(ex.id),
                          order: idx + 1,
                          sets: ex.sets,
                          reps: String(ex.reps),
                          intensity: ex.weight
                            ? `${ex.weight}kg`
                            : "Bodyweight",
                          restTime: ex.rest || 60,
                        }),
                      ),
                    },
                  }),
                ),
              },
            },
          },
        },
      });

      await prisma.programSelection.upsert({
        where: {
          goal_level_daysPerWeek_gender: {
            goal,
            level,
            daysPerWeek: plan.days_per_week,
            gender,
          },
        },
        update: { programId: program.id },
        create: {
          goal,
          level,
          daysPerWeek: plan.days_per_week,
          gender,
          programId: program.id,
        },
      });
    }

    console.log(
      `[SeedUtil] Auto-seed complete. Processed ${plans.length} templates.`,
    );
  } catch (error) {
    console.error("[SeedUtil] Auto-seed failed:", error);
  }
}
