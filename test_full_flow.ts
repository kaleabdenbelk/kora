import prisma from "./packages/db/src/index.ts";
import { PlanService } from "./packages/api/src/services/plan.service";

const planService = new PlanService();

async function runTest() {
    console.log("--- TEST: Full Plan Generation Flow ---");

    // 1. Check existing templates
    const selections = await prisma.programSelection.findMany({
        include: { program: true }
    });
    console.log(`Found ${selections.length} program selections.`);
    if (selections.length === 0) {
        console.error("NO PROGRAM SELECTIONS FOUND! Seeding might have failed or is incomplete.");
        process.exit(1);
    }

    const firstSelection = selections[0];
    console.log("Using template criteria:", {
        goal: firstSelection.goal,
        level: firstSelection.level,
        days: firstSelection.daysPerWeek,
        gender: firstSelection.gender,
        program: firstSelection.program.name
    });

    // 2. Create a test user
    const testEmail = `test_${Date.now()}@example.com`;
    const user = await prisma.user.create({
        data: {
            id: Math.random().toString(36).substring(2, 15),
            email: testEmail,
            name: "Test User",
            emailVerified: true
        }
    });
    console.log(`Created test user: ${user.id} (${user.email})`);

    // 3. Perform onboarding
    console.log("Starting onboarding...");
    const onboarding = await prisma.onboarding.create({
        data: {
            userId: user.id,
            goal: firstSelection.goal,
            trainingLevel: firstSelection.level,
            trainingDaysPerWeek: firstSelection.daysPerWeek,
            gender: firstSelection.gender,
            preferredName: "Tester"
        }
    });
    console.log("Onboarding record created.");

    // 4. Trigger plan generation
    try {
        console.log("Triggering plan generation...");
        const plan = await planService.generatePlan(user.id);
        console.log("PLAN GENERATED SUCCESSFULLY!", plan.id);
        
        // Verify sessions
        const sessionCount = await prisma.userSession.count({ where: { planId: plan.id } });
        console.log(`Verified: ${sessionCount} sessions created.`);
    } catch (err) {
        console.error("PLAN GENERATION FAILED:", err.message);
    }

    process.exit(0);
}

runTest().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
