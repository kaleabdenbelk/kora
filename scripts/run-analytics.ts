import { AnalyticsService } from "../packages/api/src/services/analytics.service";
import prisma from "../packages/db/src/index";

async function run() {
  const userEmail = process.argv[2];
  if (!userEmail) {
    console.error("Usage: tsx scripts/run-analytics.ts <userEmail>");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) {
    console.error("User not found for email:", userEmail);
    process.exit(1);
  }

  const service = new AnalyticsService();
  const distribution = await service.getMuscleDistribution(user.id, 30);
  console.log(JSON.stringify(distribution, null, 2));
}

run();
