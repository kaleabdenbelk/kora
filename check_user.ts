import prisma from "./packages/db/src/index.ts";

async function checkUser() {
    const user = await prisma.user.findUnique({
        where: { email: "test3@example.com" }
    });
    console.log("USER:", user);
    process.exit(0);
}

checkUser();
