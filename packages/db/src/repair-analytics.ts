import { AnalyticsService } from "../../api/src/services/analytics.service";
import prisma from "./index";

async function repairUserAnalytics(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error("❌ User not found");
    return;
  }

  console.log(`\n🛠️  Repairing Analytics for: ${email} (${user.id})`);

  const analytics = new AnalyticsService();

  // 1. Fetch all completed sessions
  const sessions = await prisma.userSession.findMany({
    where: {
      userId: user.id,
      completedStatus: true,
      isDeleted: false,
    },
    orderBy: { completedAt: "asc" },
  });

  console.log(`📡 Found ${sessions.length} sessions to re-process...`);

  for (const session of sessions) {
    console.log(
      `   🔸 Processing Session: ${session.id} (${session.completedAt?.toISOString()})`,
    );
    try {
      await analytics.processSessionEngine(user.id, session.id);
    } catch (err) {
      console.error(`      ❌ Error processing ${session.id}:`, err);
    }
  }

  console.log("\n✅ Repair Complete.");
}

const email = process.argv[2] || "kaleabdenbel1921@gmail.com";
repairUserAnalytics(email)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
