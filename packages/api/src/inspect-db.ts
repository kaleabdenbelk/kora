import prisma from "@kora/db";

async function inspect() {
  const plans = await prisma.userPlan.findMany({
    where: { isDeleted: false },
    include: {
      _count: {
        select: { sessions: true },
      },
    },
  });

  console.log(`Found ${plans.length} active plans.`);
  for (const p of plans) {
    console.log(
      `Plan: "${p.name}" (ID: ${p.id}) - Total Sessions: ${p._count.sessions} - Active: ${p.isActive}`,
    );
  }
}

inspect()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
