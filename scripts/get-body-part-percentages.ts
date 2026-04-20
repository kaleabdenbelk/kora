import prisma from "@kora/db";

/**
 * Calculates the percentage volume distribution per body part for a given user and time period.
 *
 * @param userId - The user's unique ID.
 * @param days - Number of days to include in the analytics.
 * @returns An array of { bodyPart: string, percentage: number } objects.
 */
async function getBodyPartPercentages(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.userExerciseLog.findMany({
    where: {
      session: { userId, startedAt: { gte: since } },
      isDeleted: false,
    },
    include: {
      exercise: {
        include: {
          muscles: { include: { muscle: true } },
          category: true, // Assuming Category might represent broader body part groups
        },
      },
    },
  });

  const muscleVolumes: Record<string, number> = {};
  let totalVolume = 0;

  for (const log of logs) {
    const weights = Array.isArray(log.weightsPerSet) ? (log.weightsPerSet as number[]) : [];
    const reps = Array.isArray(log.repsPerSet) ? (log.repsPerSet as number[]) : [];
    const volume = weights.reduce((sum, w, i) => sum + w * (reps[i] ?? 0), 0);

    if (volume === 0) continue;

    for (const em of log.exercise.muscles) {
      const muscleName = em.muscle.name;
      muscleVolumes[muscleName] = (muscleVolumes[muscleName] ?? 0) + volume;
      totalVolume += volume;
    }
  }

  const result = Object.entries(muscleVolumes).map(([muscleName, volume]) => ({
    bodyPart: muscleName,
    percentage: totalVolume > 0 ? Math.round((volume / totalVolume) * 100) : 0,
  }));

  return result.sort((a, b) => b.percentage - a.percentage);
}

// Example usage:
// const stats = await getBodyPartPercentages("user-uuid", 30);
// console.log(stats);
