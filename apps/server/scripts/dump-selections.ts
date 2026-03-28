import prisma from "@kora/db";

async function main() {
  const selections = await prisma.programSelection.findMany({
    include: { program: true }
  });
  console.log(JSON.stringify(selections, null, 2));
}

main().catch(console.error);
