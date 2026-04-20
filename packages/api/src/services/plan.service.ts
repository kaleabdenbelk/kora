import prisma from "@kora/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CustomPlanDay {
  dayNumber: number; // 1 = Monday … 7 = Sunday
  name: string;
  exercises: {
    exerciseId: string;
    sets: number;
    reps: string;
    restTime?: number;
    intensity?: string;
  }[];
}

export interface CreateCustomPlanInput {
  id?: string; // Optional for updates
  name: string;
  days: CustomPlanDay[];
  durationWeeks?: number; // defaults to 8
}

export type ReplaceScope = "next" | "all";

// ─── Service ──────────────────────────────────────────────────────────────────

export class PlanService {
  // ---------------------------------------------------------------------------
  // generatePlan — called from onboarding completion
  // ---------------------------------------------------------------------------
  async generatePlan(userId: string) {
    const profile = await prisma.onboarding.findUnique({ where: { userId } });
    if (!profile || !profile.goal || !profile.trainingLevel || !profile.trainingDaysPerWeek) {
      throw new Error("Onboarding incomplete");
    }

    await prisma.userPlan.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

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
                  include: { exercises: { include: { exercise: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!selection) throw new Error("No matching program template found.");

    const { program } = selection;

    return await prisma.$transaction(async (tx) => {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + program.durationWeeks * 7);

      const weeks: any[] = [];
      let jsonCurrentWeek = 1;
      for (const phase of program.phases) {
        for (let w = 0; w < phase.durationWeeks; w++) {
          const weekNumber = jsonCurrentWeek + w;
          const sessions = phase.workouts.map((wt) => ({
            dayNumber: wt.dayNumber,
            name: wt.name,
            rest: false,
            exercises: wt.exercises.map((et) => ({
              exerciseId: et.exercise.id,
              name: et.exercise.name,
              gifUrl: et.exercise.gifUrl || null,
              sets: et.sets,
              reps: et.reps,
              intensity: et.intensity,
              restTime: et.restTime,
            })),
          }));
          weeks.push({ weekNumber, sessions });
        }
        jsonCurrentWeek += phase.durationWeeks;
      }

      const userPlan = await tx.userPlan.create({
        data: {
          userId,
          programId: program.id,
          name: program.name,
          source: "AI_GENERATED",
          isActive: true,
          startDate,
          endDate,
          planJson: { programName: program.name, weeks },
        },
      });

      const sessionData: any[] = [];
      let currentWeek = 1;
      for (const phase of program.phases) {
        for (let w = 0; w < phase.durationWeeks; w++) {
          const weekNumber = currentWeek + w;
          for (const wt of phase.workouts) {
            sessionData.push({
              userId,
              planId: userPlan.id,
              dayNumber: wt.dayNumber,
              week: weekNumber,
              planned: {
                name: wt.name,
                exercises: wt.exercises.map((et) => ({
                  exerciseId: et.exerciseId,
                  name: et.exercise.name,
                  gifUrl: et.exercise.gifUrl || null,
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
      return userPlan;
    });
  }

  // ---------------------------------------------------------------------------
  // createCustomPlan — Surgical Update or Create
  // ---------------------------------------------------------------------------
  async createCustomPlan(userId: string, input: CreateCustomPlanInput) {
    // BLOAT PREVENTION: Deduplicate days by dayNumber to prevent accidental multiplication
    const uniqueDaysMap = new Map();
    for (const d of input.days) {
      if (!uniqueDaysMap.has(d.dayNumber)) {
        uniqueDaysMap.set(d.dayNumber, d);
      }
    }
    const deduplicatedDays = Array.from(uniqueDaysMap.values());

    const isFullPlan = deduplicatedDays.length > 28;
    const durationWeeks = isFullPlan ? 1 : (input.durationWeeks ?? 8);
    
    // Safety check: Total sessions should not exceed a reasonable limit (e.g. 500)
    const totalSessions = deduplicatedDays.length * durationWeeks;
    if (totalSessions > 600) {
      throw new Error(`Plan too large: ${totalSessions} sessions requested. Maximum is 600.`);
    }

    const exerciseIds = [...new Set(deduplicatedDays.flatMap((d) => d.exercises.map((e) => e.exerciseId)))];
    const found = await prisma.exercise.findMany({
      where: { id: { in: exerciseIds }, isDeleted: false },
      select: { id: true, name: true, gifUrl: true },
    });
    const exerciseMap = new Map(found.map((e) => [e.id, e]));

    const missing = exerciseIds.filter((id) => !exerciseMap.has(id));
    if (missing.length > 0) throw new Error(`Unknown exercise IDs: ${missing.join(", ")}`);

    const weeksTemplate = Array.from({ length: durationWeeks }, (_, i) => ({
      weekNumber: i + 1,
      sessions: deduplicatedDays.map((day) => ({
        dayNumber: day.dayNumber,
        name: day.name,
        rest: false,
        exercises: day.exercises.map((ex) => {
          const meta = exerciseMap.get(ex.exerciseId)!;
          return {
            exerciseId: ex.exerciseId,
            name: meta.name,
            gifUrl: meta.gifUrl || null,
            sets: ex.sets,
            reps: ex.reps,
            intensity: ex.intensity ?? null,
            restTime: ex.restTime ?? 90,
          };
        }),
      })),
    }));

    return await prisma.$transaction(async (tx) => {
      let finalId = input.id;

      // SMART DEDUPLICATION: If ID is missing, try to find an active plan with the same name
      if (!finalId) {
        const existingByName = await tx.userPlan.findFirst({
          where: { userId, name: input.name, isDeleted: false, isActive: true },
          select: { id: true },
        });
        if (existingByName) finalId = existingByName.id;
      }

      let userPlan;

      if (finalId) {
        userPlan = await tx.userPlan.findUnique({ where: { id: finalId } });
        if (!userPlan) throw new Error("Plan not found for update.");

        const endDate = new Date(userPlan.startDate);
        endDate.setDate(userPlan.startDate.getDate() + durationWeeks * 7);

        // Deactivate others
        await tx.userPlan.updateMany({
          where: { userId, isActive: true, id: { not: finalId } },
          data: { isActive: false },
        });

        userPlan = await tx.userPlan.update({
          where: { id: finalId },
          data: {
            name: input.name,
            isActive: true,
            endDate,
            planJson: { programName: input.name, weeks: weeksTemplate },
          },
        });

        // RE-STRUCTURE SESSIONS: To fix "9216 session" bloat, we strictly enforce the new structure
        // 1. Fetch current uncompleted sessions
        const currentSessions = await tx.userSession.findMany({
          where: { planId: finalId, completedStatus: false, startedAt: null },
        });

        console.log(`[PlanService] Updating existing plan ${finalId}`);

        const sessionMap = new Map(currentSessions.map((s) => [`${s.week}-${s.dayNumber}`, s]));

        // 2. Clear sessions that are outside the new template range
        const maxDay = Math.max(...deduplicatedDays.map((d) => d.dayNumber));
        await tx.userSession.updateMany({
          where: {
            planId: finalId,
            OR: [{ week: { gt: durationWeeks } }, { dayNumber: { gt: maxDay } }],
            completedStatus: false,
            startedAt: null,
          },
          data: { isDeleted: true },
        });

        const newSessions: any[] = [];

        for (let w = 1; w <= durationWeeks; w++) {
          for (const day of deduplicatedDays) {
            const key = `${w}-${day.dayNumber}`;
            const existing = sessionMap.get(key);

            const sessionStructure = {
              name: day.name,
              exercises: day.exercises.map((ex) => {
                const meta = exerciseMap.get(ex.exerciseId)!;
                return {
                  exerciseId: ex.exerciseId,
                  name: meta.name,
                  gifUrl: meta.gifUrl || null,
                  sets: ex.sets,
                  reps: ex.reps,
                  intensity: ex.intensity ?? null,
                  restTime: ex.restTime ?? 90,
                };
              }),
            };

            if (existing) {
              await tx.userSession.update({
                where: { id: existing.id },
                data: { planned: sessionStructure, isDeleted: false },
              });
            } else {
              newSessions.push({
                userId,
                planId: userPlan.id,
                dayNumber: day.dayNumber,
                week: w,
                planned: sessionStructure,
              });
            }
          }
        }

        if (newSessions.length > 0) {
          await tx.userSession.createMany({ data: newSessions });
        }
      } else {
        await tx.userPlan.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + durationWeeks * 7);

        userPlan = await tx.userPlan.create({
          data: {
            userId,
            name: input.name,
            source: "CUSTOM",
            isActive: true,
            startDate,
            endDate,
            planJson: { programName: input.name, weeks: weeksTemplate },
          },
        });

        const sessionData = [];
        for (let w = 1; w <= durationWeeks; w++) {
          for (const day of deduplicatedDays) {
            sessionData.push({
              userId,
              planId: userPlan.id,
              dayNumber: day.dayNumber,
              week: w,
              planned: {
                name: day.name,
                exercises: day.exercises.map((ex) => {
                  const meta = exerciseMap.get(ex.exerciseId)!;
                  return {
                    exerciseId: ex.exerciseId,
                    name: meta.name,
                    gifUrl: meta.gifUrl || null,
                    sets: ex.sets,
                    reps: ex.reps,
                    intensity: ex.intensity ?? null,
                    restTime: ex.restTime ?? 90,
                  };
                }),
              },
            });
          }
        }
        console.log(`[PlanService] Created new sessions: ${sessionData.length}`);
        await tx.userSession.createMany({ data: sessionData });
      }

      console.log(`[PlanService] Plan ${userPlan!.id} ready. Returning enriched data...`);
      return await tx.userPlan.findUnique({
        where: { id: userPlan!.id },
        include: {
          sessions: {
            where: { isDeleted: false },
            orderBy: [{ week: "asc" }, { dayNumber: "asc" }],
          },
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  async updateDayTemplate(userId: string, planId: string, dayNumber: number, dayUpdate: CustomPlanDay) {
    return await prisma.$transaction(async (tx) => {
      const plan = await tx.userPlan.findFirst({
        where: { id: planId, userId, isDeleted: false },
      });
      if (!plan) throw new Error("Plan not found");

      // 1. Resolve exercise metadata
      const exerciseIds = dayUpdate.exercises.map((e) => e.exerciseId);
      const found = await tx.exercise.findMany({
        where: { id: { in: exerciseIds }, isDeleted: false },
        select: { id: true, name: true, gifUrl: true },
      });
      const exerciseMap = new Map(found.map((e) => [e.id, e]));

      const missing = exerciseIds.filter((id) => !exerciseMap.has(id));
      if (missing.length > 0) throw new Error(`Unknown exercise IDs: ${missing.join(", ")}`);

      const sessionStructure = {
        name: dayUpdate.name,
        exercises: dayUpdate.exercises.map((ex) => {
          const meta = exerciseMap.get(ex.exerciseId)!;
          return {
            exerciseId: ex.exerciseId,
            name: meta.name,
            gifUrl: meta.gifUrl || null,
            sets: ex.sets,
            reps: ex.reps,
            intensity: ex.intensity ?? null,
            restTime: ex.restTime ?? 90,
          };
        }),
      };

      // 2. Update Master Plan Template (planJson)
      const planJson = plan.planJson as any;
      if (planJson?.weeks) {
        const updatedWeeks = planJson.weeks.map((week: any) => ({
          ...week,
          sessions: week.sessions.map((sess: any) => {
            if (sess.dayNumber !== dayNumber) return sess;
            return {
              ...sess,
              name: dayUpdate.name,
              exercises: sessionStructure.exercises,
            };
          }),
        }));

        // Auto-activate the plan
        await tx.userPlan.update({
          where: { id: planId },
          data: { 
            planJson: { ...planJson, weeks: updatedWeeks },
            isActive: true 
          },
        });

        // Deactivate others
        await tx.userPlan.updateMany({
          where: { userId, isActive: true, id: { not: planId } },
          data: { isActive: false },
        });
      }

      // 3. Update all future uncompleted sessions for this day
      const updatedCount = await tx.userSession.updateMany({
        where: {
          planId,
          userId,
          dayNumber,
          completedStatus: false,
          startedAt: null,
          isDeleted: false,
        },
        data: {
          planned: sessionStructure,
        },
      });

      // Return full enriched plan
      return await tx.userPlan.findUnique({
        where: { id: planId },
        include: {
          sessions: {
            where: { isDeleted: false },
            orderBy: [{ week: "asc" }, { dayNumber: "asc" }],
          },
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // replaceExercise — syncs instances AND master template
  // ---------------------------------------------------------------------------
  async replaceExercise(userId: string, planId: string, oldExerciseId: string, newExerciseId: string, scope: ReplaceScope = "all") {
    const plan = await prisma.userPlan.findFirst({
      where: { id: planId, userId, isDeleted: false },
    });
    if (!plan) throw new Error("Plan not found");

    const newExercise = await prisma.exercise.findUnique({
      where: { id: newExerciseId },
      select: { id: true, name: true, gifUrl: true },
    });
    if (!newExercise) throw new Error("Exercise not found");

    const futureSessions = await prisma.userSession.findMany({
      where: { planId, userId, completedStatus: false, startedAt: null, isDeleted: false },
      orderBy: [{ week: "asc" }, { dayNumber: "asc" }],
    });

    const toUpdate = scope === "next" ? futureSessions.slice(0, 1) : futureSessions;

    let updatedCount = 0;
    for (const session of toUpdate) {
      const planned = session.planned as any;
      if (!planned?.exercises) continue;

      const updatedExercises = planned.exercises.map((ex: any) => {
        if (ex.exerciseId !== oldExerciseId) return ex;
        return { ...ex, exerciseId: newExercise.id, name: newExercise.name, gifUrl: newExercise.gifUrl || null };
      });

      await prisma.userSession.update({
        where: { id: session.id },
        data: { planned: { ...planned, exercises: updatedExercises } },
      });
      updatedCount++;
    }

    if (updatedCount > 0) {
      const planJson = plan.planJson as any;
      if (planJson?.weeks) {
        const updatedWeeks = planJson.weeks.map((week: any) => ({
          ...week,
          sessions: week.sessions.map((sess: any) => ({
            ...sess,
            exercises: sess.exercises.map((ex: any) => {
              if (ex.exerciseId !== oldExerciseId) return ex;
              return { ...ex, exerciseId: newExercise.id, name: newExercise.name, gifUrl: newExercise.gifUrl || null };
            }),
          })),
        }));
        await prisma.userPlan.update({ where: { id: planId }, data: { planJson: { ...planJson, weeks: updatedWeeks } } });
      }
    }

    return { success: true, updatedSessions: updatedCount };
  }

  async getActivePlan(userId: string) {
    return prisma.userPlan.findFirst({
      where: { userId, isActive: true, isDeleted: false },
      orderBy: { createdAt: "desc" },
      include: {
        sessions: {
          where: { isDeleted: false },
          orderBy: [{ week: "asc" }, { dayNumber: "asc" }],
        },
      },
    });
  }

  async listPlans(userId: string) {
    return prisma.userPlan.findMany({
      where: { userId, isDeleted: false },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        source: true,
        isActive: true,
        createdAt: true,
        startDate: true,
        endDate: true,
        planJson: true, // Included so overview is not "shallow"
        _count: { select: { sessions: { where: { completedStatus: true } } } },
        sessions: { where: { isDeleted: false }, select: { id: true } },
      },
    });
  }

  async getById(userId: string, planId: string) {
    return prisma.userPlan.findFirst({
      where: { id: planId, userId, isDeleted: false },
      include: {
        sessions: {
          where: { isDeleted: false },
          orderBy: [{ week: "asc" }, { dayNumber: "asc" }],
        },
      },
    });
  }

  async setActivePlan(userId: string, planId: string) {
    const target = await prisma.userPlan.findFirst({ where: { id: planId, userId, isDeleted: false } });
    if (!target) throw new Error("Plan not found");

    await prisma.$transaction([
      prisma.userPlan.updateMany({ where: { userId, isActive: true }, data: { isActive: false } }),
      prisma.userPlan.update({ where: { id: planId }, data: { isActive: true } }),
    ]);

    return { success: true, activePlanId: planId };
  }
}
