import prisma from './index';

async function checkLatestLogs(userId: string) {
  const latestLog = await prisma.userExerciseLog.findFirst({
    where: { session: { userId } },
    orderBy: { createdAt: 'desc' },
    include: { exercise: true }
  });

  if (!latestLog) {
    console.log("No exercise logs found for this user.");
    return;
  }

  console.log(`\n🔍 Analyzing Latest Log for Exercise: ${latestLog.exercise.name}`);
  console.log(`   Weights (Type: ${typeof latestLog.weightsPerSet}):`, latestLog.weightsPerSet);
  console.log(`   Reps (Type: ${typeof latestLog.repsPerSet}):`, latestLog.repsPerSet);
  
  const weights = latestLog.weightsPerSet;
  const reps = latestLog.repsPerSet;

  if (Array.isArray(weights)) {
    console.log("✅ Weights is definitely an array.");
  } else if (typeof weights === 'string') {
    console.log("⚠️  Weights is a STRING. Needs parsing.");
    try {
        const parsed = JSON.parse(weights);
        console.log("   Parsed successfully:", parsed);
    } catch {
        console.log("   Parsing FAILED.");
    }
  } else {
    console.log("❓ Weights is some other type:", typeof weights);
  }
}

checkLatestLogs('0GFAoOd4be3UEZHuW324531V3eGX0V9f')
  .catch(console.error)
  .finally(() => prisma.$disconnect());
