import prisma from './index';

async function analyzeStreak(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { onboarding: true }
  });

  if (!user) {
    console.error("User not found");
    return;
  }

  console.log(`\n🔥 Detailed Analytics for: ${email}`);
  console.log(`   User ID:         ${user.id}`);
  console.log(`   Current Streak:  ${user.currentStreak}`);
  console.log(`   Training Days:   ${user.onboarding?.trainingDaysPerWeek ?? "Not set (defaulting to 3-day grace)"}`);

  const [sessions, caloricLogs] = await Promise.all([
    prisma.userSession.findMany({
      where: { userId: user.id, completedStatus: true, isDeleted: false },
      orderBy: { completedAt: 'asc' },
    }),
    prisma.dailyCaloricLog.findMany({
      where: { userId: user.id },
      orderBy: { date: 'asc' },
    })
  ]);

  if (sessions.length === 0) {
    console.log("⚠️ No completed sessions found.");
    return;
  }

  // Group data by date
  const dailyData: Record<string, { sessions: any[], calories?: any }> = {};

  for (const s of sessions) {
    const d = new Date(s.completedAt!).toLocaleDateString("en-CA"); // YYYY-MM-DD
    if (!dailyData[d]) dailyData[d] = { sessions: [] };
    dailyData[d].sessions.push(s);
  }

  for (const l of caloricLogs) {
    const d = l.date.toLocaleDateString("en-CA");
    if (!dailyData[d]) dailyData[d] = { sessions: [] };
    dailyData[d].calories = l;
  }

  const sortedDates = Object.keys(dailyData).sort();
  
  let currentStreak = 0;
  let lastDate: Date | null = null;
  const trainingDays = user.onboarding?.trainingDaysPerWeek;
  
  const getMaxAllowedGap = (n: number | null | undefined) => {
    switch (n) {
      case 7: return 1;
      case 6: return 2;
      case 5: return 3;
      case 4: return 3;
      case 3: return 4;
      case 2: return 5;
      case 1: return 7;
      default: return 3;
    }
  };
  const allowedGap = getMaxAllowedGap(trainingDays);

  console.log(`\n📅 Daily Breakdown:`);
  console.log(`══════════════════════════════════════════════════`);

  for (const dateStr of sortedDates) {
    const day = dailyData[dateStr];
    const today = new Date(dateStr);
    today.setHours(0,0,0,0);

    // Calculate streak progression
    if (!lastDate) {
      currentStreak = 1;
    } else {
      const diffDays = Math.round((today.getTime() - lastDate.getTime()) / 86400000);
      if (diffDays > 0) {
        if (diffDays <= allowedGap) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      }
    }

    const totalSeconds = day.sessions.reduce((a, s) => a + (s.totalDurationSeconds ?? 0), 0);
    const activeMins = day.sessions.reduce((a, s) => a + (s.activeMinutes ?? 0), 0);
    const totalVol = day.sessions.reduce((a, s) => a + (s.totalVolumeKg ?? 0), 0);
    const workoutBurn = day.calories?.workoutBurn ?? 0;
    const totalBurn = day.calories?.totalBurn ?? 0;

    console.log(`\n🗓️  DATE: ${dateStr} (Day ${currentStreak} of current streak)`);
    console.log(`   🏋️  Workouts:    ${day.sessions.length}`);
    console.log(`   ⏱️  Active Time: ${(totalSeconds / 3600).toFixed(1)}h (${Math.round(activeMins)} active min)`);
    console.log(`   🔥 Calories:    ${Math.round(workoutBurn)} kcal (Workout) | ${Math.round(totalBurn)} kcal (Total)`);
    console.log(`   💪 Tonnage:     ${totalVol.toFixed(1)} kg`);

    lastDate = today;
  }

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`🏁 Summary: Calculated current streak is ${currentStreak}`);
}

const email = process.argv[2] || 'kaleabdenbel1921@gmail.com';
analyzeStreak(email)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
