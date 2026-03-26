import prisma from "./packages/db/src/index.ts";

async function checkOnboarding() {
    const onboarding = await prisma.onboarding.findUnique({
        where: { userId: "zq0n4w8pR8ScEH35G0Fc9tirph1uzqz9" }
    });
    console.log("ONBOARDING:", onboarding);
    process.exit(0);
}

checkOnboarding();
