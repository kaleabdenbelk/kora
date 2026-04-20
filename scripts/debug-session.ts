import prisma from "../packages/db/src/index";

async function check() {
  const email = "westen2114@gmail.com";
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userSessions: {
        orderBy: { completedAt: 'desc' },
        take: 1,
        include: { exercises: true }
      }
    }
  });

  if (!user || !user.userSessions[0]) {
    console.log("No session found");
    return;
  }

  const s = user.userSessions[0];
  console.log("SESSION RAW DATA:");
  console.log("- ID:", s.id);
  console.log("- Completed Status:", s.completedStatus);
  console.log("- Total Volume:", s.totalVolumeKg);
  console.log("- Active Minutes:", s.activeMinutes);
  console.log("- CompletedAt:", s.completedAt);
  
  console.log("\nEXERCISES:");
  s.exercises.forEach((ex, i) => {
    console.log(`[${i}] ${ex.exerciseId}: weight: ${JSON.stringify(ex.weightsPerSet)}, reps: ${JSON.stringify(ex.repsPerSet)}`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
