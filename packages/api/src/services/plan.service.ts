import prisma from "@kora/db";

export class PlanService {
  /**
   * Generates a workout plan based on the user's onboarding data.
   */
  async generatePlan(userId: string) {
    // 1. Get user profile
    const profile = await prisma.onboarding.findUnique({
      where: { userId },
    });

    if (
      !profile ||
      !profile.goal ||
      !profile.trainingLevel ||
      !profile.trainingDaysPerWeek
    ) {
      throw new Error("Onboarding incomplete");
    }

    // 1.5. Check if the user already has an active plan
    const existingPlan = await prisma.userPlan.findFirst({
      where: { userId },
    });
    if (existingPlan) {
      // In a real iteration, we might allow overriding. For now, we secure against duplicates.
      throw new Error("User already has an active plan.");
    }

    // 2. Find matching program template
    const selection = await prisma.programSelection.findUnique({
      where: {
        goal_level_daysPerWeek_gender: {
          goal: profile.goal,
          level: profile.trainingLevel,
          daysPerWeek: profile.trainingDaysPerWeek,
          gender: profile.gender!,
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
                      include: {
                        exercise: true,
                      },
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
      console.error("[PlanService] No matching program found for:", {
        goal: profile.goal,
        level: profile.trainingLevel,
        days: profile.trainingDaysPerWeek,
        gender: profile.gender,
      });
      throw new Error("No matching program template found for your profile.");
    }

    console.log(
      `[PlanService] Program found: ${selection.program.name}. Creating UserPlan...`,
    );
    const { program } = selection;

    // 3. Create the UserPlan and its sessions in a transaction
    return await prisma.$transaction(async (tx) => {
      console.log("[PlanService] Starting transaction...");
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + program.durationWeeks * 7);

      const userPlan = await tx.userPlan.create({
        data: {
          userId,
          programId: program.id,
          startDate,
          endDate,
        },
      });

      // Flatten the program into sessions across the weeks
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
                exercises: workoutTemplate.exercises.map((et) => ({
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

      await tx.userSession.createMany({
        data: sessionData,
      });

      return userPlan;
    });
  }

  async getActivePlan(userId: string) {
    console.log(`[PlanService] Getting active plan for ${userId}...`);
    const plan = await prisma.userPlan.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        sessions: {
          orderBy: [{ week: "asc" }, { dayNumber: "asc" }],
        },
      },
    });
    console.log(`[PlanService] Plan found: ${!!plan}`);
    return plan;
  }
}
