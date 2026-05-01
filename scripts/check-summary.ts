import { AnalyticsService } from "../packages/api/src/services/analytics.service";
import prisma from "../packages/db/src/index";

async function checkSummary() {
  const email = "westen2114@gmail.com";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log("User not found.");
    return;
  }

  const analytics = new AnalyticsService();
  console.log("--- Summary for 'Day' filter ---");
  const summaryDay = await analytics.getSummary(user.id, "Day");
  console.log(JSON.stringify(summaryDay, null, 2));

  console.log("\n--- Checking raw sessions for this user ---");
  const sessions = await prisma.userSession.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      completedStatus: true,
      completedAt: true,
      totalVolumeKg: true,
    },
  });
  console.log(JSON.stringify(sessions, null, 2));
}

checkSummary()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
