import prisma from "../packages/db/src/index";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Please provide an email address.");
    process.exit(1);
  }

  console.log(`\n--- Fetching stats for: ${email} ---\n`);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userSessions: {
          where: { completedStatus: true },
          include: {
            exercises: {
              include: {
                exercise: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      console.error(`User with email ${email} not found.`);
      process.exit(1);
    }

    const completedSessions = user.userSessions;
    const totalWorkouts = completedSessions.length;

    // Aggregate unique exercises
    const exerciseMap = new Map<string, number>();
    let totalDurationSeconds = 0;
    let totalVolume = 0;

    for (const session of completedSessions) {
      totalDurationSeconds += session.totalDurationSeconds || 0;
      totalVolume += session.totalVolumeKg || 0;

      for (const log of session.exercises) {
        const name = log.exercise.name;
        exerciseMap.set(name, (exerciseMap.get(name) || 0) + 1);
      }
    }

    function formatDuration(seconds: number) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h}h ${m}m ${s}s`;
    }

    const uniqueExercises = Array.from(exerciseMap.keys());

    console.log("User Info:");
    console.log(`- Name: ${user.name}`);
    console.log(`- Current Streak: ${user.currentStreak} days`);
    console.log(`- Longest Streak: ${user.longestStreak} days`);
    console.log(
      `- Last Workout: ${user.lastWorkoutDate ? user.lastWorkoutDate.toDateString() : "Never"}`,
    );
    console.log("");
    console.log("Workout Stats:");
    console.log(`- Total Completed Workouts: ${totalWorkouts}`);
    console.log(
      `- Total Active Time: ${formatDuration(totalDurationSeconds)} (${(totalDurationSeconds / 3600).toFixed(2)} hours)`,
    );
    console.log(`- Total Volume Lifted: ${totalVolume.toLocaleString()} kg`);
    console.log("");
    console.log(`Exercises Performed (${uniqueExercises.length}):`);
    uniqueExercises.sort().forEach((ex) => {
      console.log(`- ${ex} (${exerciseMap.get(ex)} sessions)`);
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
