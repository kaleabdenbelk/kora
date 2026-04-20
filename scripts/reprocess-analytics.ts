import prisma from "../packages/db/src/index";
import { AnalyticsService } from "../packages/api/src/services/analytics.service";

async function reprocess() {
  const email = "westen2114@gmail.com";
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userSessions: {
        orderBy: { completedAt: 'desc' },
        take: 1
      }
    }
  });

  if (!user || !user.userSessions[0]) {
    console.log("No session found to reprocess.");
    return;
  }

  const sessionId = user.userSessions[0].id;
  const analytics = new AnalyticsService();
  
  console.log(`🚀 Reprocessing analytics for session: ${sessionId}...`);
  await analytics.processSessionEngine(user.id, sessionId);
  
  const updated = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { totalVolumeKg: true, activeMinutes: true }
  });

  console.log("✅ Results:");
  console.log("- Total Volume:", updated?.totalVolumeKg, "kg");
  console.log("- Active Minutes:", updated?.activeMinutes, "min");
}

reprocess().catch(console.error).finally(() => prisma.$disconnect());
