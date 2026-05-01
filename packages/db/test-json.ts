import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
  const plan = await prisma.userPlan.findFirst({
    orderBy: { createdAt: "desc" },
  });
  console.log(JSON.stringify(plan?.planJson, null, 2));
}
main().finally(() => prisma.$disconnect());
