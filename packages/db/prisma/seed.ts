import dotenv from "dotenv";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  console.log("🌱 Starting Legacy Data Seed...");

  // Dynamic imports to ensure dotenv is loaded first
  const { PrismaClient } = await import("./generated/client.js");
  const { TrainingGoal, ExperienceLevel, ExerciseType, MuscleRole, ExerciseLevel, ExerciseEnvironment, Gender } = await import("./generated/enums.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in environment");
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  const LEGACY_PATH = "/home/fugitora/Projects/Kora/kora/apps/server/public/seeds/";
  
  try {
    // 1. Seed Exercises, Muscles, Equipment
    const exercisesData = JSON.parse(fs.readFileSync(path.join(LEGACY_PATH, "exercises.json"), "utf8"));
    console.log(`📚 Processing ${exercisesData.length} exercises...`);
    
    const muscles = new Set<string>();
    const equipment = new Set<string>();
    const categories = new Set<string>();
    const movementPatterns = new Set<string>();
    
    for (const ex of exercisesData) {
      if (ex.anatomy?.primary) ex.anatomy.primary.forEach((m: string) => muscles.add(m));
      if (ex.anatomy?.secondary) ex.anatomy.secondary.forEach((m: string) => muscles.add(m));
      if (ex.anatomy?.stabilizers) ex.anatomy.stabilizers.forEach((m: string) => muscles.add(m));
      if (ex.requirements?.equipment) ex.requirements.equipment.forEach((e: string) => equipment.add(e));
      if (ex.classification?.category) categories.add(ex.classification.category);
      if (ex.classification?.movement_pattern) movementPatterns.add(ex.classification.movement_pattern);
    }

    console.log(`💪 Seeding ${muscles.size} muscles, ${equipment.size} equipment, ${categories.size} categories and ${movementPatterns.size} patterns...`);

    for (const m of muscles) {
      await prisma.muscle.upsert({ where: { name: m }, update: {}, create: { name: m } });
    }

    for (const e of equipment) {
      await prisma.equipment.upsert({ where: { name: e }, update: {}, create: { name: e } });
    }

    for (const c of categories) {
      await prisma.category.upsert({ where: { name: c }, update: {}, create: { name: c } });
    }

    for (const mp of movementPatterns) {
      await prisma.movementPattern.upsert({ where: { name: mp }, update: {}, create: { name: mp } });
    }

    const splitMap: Record<string, any> = {
      "Push": "PUSH",
      "Pull": "PULL",
      "Legs": "LEGS",
      "Core": "CORE",
      "Full Body": "FULL_BODY"
    };

    // 2. Seed Exercises
    for (const ex of exercisesData) {
      await prisma.exercise.upsert({
        where: { id: ex.id },
        update: {
          name: ex.name,
          instructions: ex.instructions || [],
          gifUrl: ex.gifUrl,
          split: ex.classification?.split ? splitMap[ex.classification.split] : null,
          tags: ex.logic_assets?.tags || [],
          alternativeIds: ex.logic_assets?.alternatives || [],
          difficultyRpeMin: ex.requirements?.difficulty_rpe?.min || null,
          difficultyRpeMax: ex.requirements?.difficulty_rpe?.max || null,
          restMin: ex.programming?.rest_minutes?.min || null,
          restMax: ex.programming?.rest_minutes?.max || null,
          defaultSets: ex.programming?.default_sets || null,
          defaultReps: ex.programming?.default_reps || null,
          metValue: ex.programming?.met_value || null,
          caloriesPerSetAvg: ex.programming?.calories_per_set_avg || null,
          category: ex.classification?.category ? { connect: { name: ex.classification.category } } : { disconnect: true },
          movementPattern: ex.classification?.movement_pattern ? { connect: { name: ex.classification.movement_pattern } } : { disconnect: true },
        },
        create: {
          id: ex.id,
          name: ex.name,
          instructions: ex.instructions || [],
          gifUrl: ex.gifUrl,
          type: ex.classification?.type?.toUpperCase() === "COMPOUND" ? ExerciseType.COMPOUND : ExerciseType.ISOLATION,
          level: ExerciseLevel.INTERMEDIATE,
          environment: ExerciseEnvironment.GYM,
          split: ex.classification?.split ? splitMap[ex.classification.split] : null,
          tags: ex.logic_assets?.tags || [],
          alternativeIds: ex.logic_assets?.alternatives || [],
          difficultyRpeMin: ex.requirements?.difficulty_rpe?.min || null,
          difficultyRpeMax: ex.requirements?.difficulty_rpe?.max || null,
          restMin: ex.programming?.rest_minutes?.min || null,
          restMax: ex.programming?.rest_minutes?.max || null,
          defaultSets: ex.programming?.default_sets || null,
          defaultReps: ex.programming?.default_reps || null,
          metValue: ex.programming?.met_value || null,
          caloriesPerSetAvg: ex.programming?.calories_per_set_avg || null,
          category: ex.classification?.category ? { connect: { name: ex.classification.category } } : undefined,
          movementPattern: ex.classification?.movement_pattern ? { connect: { name: ex.classification.movement_pattern } } : undefined,
          muscles: {
            create: [
              ...(ex.anatomy?.primary || []).map((m: string) => ({
                muscle: { connect: { name: m } },
                role: MuscleRole.PRIMARY
              })),
              ...(ex.anatomy?.secondary || []).map((m: string) => ({
                muscle: { connect: { name: m } },
                role: MuscleRole.SECONDARY
              })),
              ...(ex.anatomy?.stabilizers || []).map((m: string) => ({
                muscle: { connect: { name: m } },
                role: MuscleRole.STABILIZER
              }))
            ]
          },
          equipment: {
            create: (ex.requirements?.equipment || []).map((e: string) => ({
              equipment: { connect: { name: e } }
            }))
          }
        }
      });
    }

    // 3. Seed Programs from Ready_Kora.json
    const rawPlans = JSON.parse(fs.readFileSync(path.join(LEGACY_PATH, "Ready_Kora.json"), "utf8"));
    const plans = rawPlans.plans;

    console.log(`📋 Seeding ${plans.length} program templates...`);

    for (const plan of plans) {
      const goalMap: Record<string, any> = {
        "hypertrophy": TrainingGoal.HYPERTROPHY,
        "strength": TrainingGoal.STRENGTH,
        "powerbuilding": TrainingGoal.POWERBUILDING,
        "fat_loss": TrainingGoal.FAT_LOSS,
        "maintenance": TrainingGoal.MAINTENANCE
      };

      const levelMap: Record<string, any> = {
        "beginner": ExperienceLevel.BEGINNER,
        "intermediate": ExperienceLevel.INTERMEDIATE,
        "advanced": ExperienceLevel.ADVANCED
      };

      const genderMap: Record<string, any> = {
        "male": Gender.MALE,
        "female": Gender.FEMALE
      };

      const program = await prisma.program.upsert({
        where: { id: plan.plan_id },
        update: {},
        create: {
          id: plan.plan_id,
          name: plan.plan_id.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
          goal: goalMap[plan.goal] || TrainingGoal.HYPERTROPHY,
          level: levelMap[plan.level] || ExperienceLevel.BEGINNER,
          durationWeeks: 6,
          phases: {
            create: {
              name: "Main Phase",
              order: 1,
              durationWeeks: 6,
              workouts: {
                create: plan.week_1.map((w: any) => ({
                  name: w.name,
                  dayNumber: w.day,
                  exercises: {
                    create: w.exercises.map((ex: any, idx: number) => ({
                      exerciseId: ex.id,
                      order: idx + 1,
                      sets: ex.sets,
                      reps: String(ex.reps),
                      intensity: ex.weight ? `${ex.weight}kg` : "Bodyweight",
                      restTime: ex.rest || 60
                    }))
                  }
                }))
              }
            }
          }
        }
      });

      await prisma.programSelection.upsert({
        where: {
          goal_level_daysPerWeek_gender: {
            goal: goalMap[plan.goal] || TrainingGoal.HYPERTROPHY,
            level: levelMap[plan.level] || ExperienceLevel.BEGINNER,
            daysPerWeek: plan.days_per_week,
            gender: genderMap[plan.gender] || Gender.MALE
          }
        },
        update: { programId: program.id },
        create: {
          goal: goalMap[plan.goal] || TrainingGoal.HYPERTROPHY,
          level: levelMap[plan.level] || ExperienceLevel.BEGINNER,
          daysPerWeek: plan.days_per_week,
          gender: genderMap[plan.gender] || Gender.MALE,
          programId: program.id
        }
      });
    }

    console.log("✅ Seed completed successfully!");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("💥 Fatal error in main:", e);
  process.exit(1);
});
