import prisma from "@kora/db";

async function cleanup() {
  console.log("Starting cleanup of bloated plans...");

  // Find users with excessive sessions
  const bloatedPlans = await prisma.userPlan.findMany({
    where: {
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      userId: true,
      _count: {
        select: { sessions: { where: { isDeleted: false } } },
      },
    },
  });

  const suspicious = bloatedPlans.filter((p) => p._count.sessions > 500);

  if (suspicious.length === 0) {
    console.log("No bloated plans found (> 500 sessions).");
    return;
  }

  console.log(`Found ${suspicious.length} suspicious plans.`);

  for (const plan of suspicious) {
    console.log(
      `Cleaning plan: ${plan.name} (ID: ${plan.id}) with ${plan._count.sessions} sessions...`,
    );

    // We'll keep only the first occurrence of each (week, dayNumber) to be safe,
    // or better yet, since it's a custom plan that exploded, we'll keep the first cycle.

    const allSessions = await prisma.userSession.findMany({
      where: { planId: plan.id, isDeleted: false },
      orderBy: [{ week: "asc" }, { dayNumber: "asc" }, { createdAt: "asc" }],
    });

    const seen = new Set<string>();
    const toDelete: string[] = [];

    for (const session of allSessions) {
      const key = `${session.week}-${session.dayNumber}`;
      if (seen.has(key)) {
        toDelete.push(session.id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length > 0) {
      console.log(
        `Deleting ${toDelete.length} redundant sessions for plan ${plan.id}...`,
      );
      await prisma.userSession.deleteMany({
        where: { id: { in: toDelete } },
      });
    }
  }

  console.log("Cleanup complete.");
}

cleanup()
  .catch((e) => {
    console.error("Error during cleanup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
