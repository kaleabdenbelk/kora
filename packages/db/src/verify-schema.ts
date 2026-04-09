import prisma from "./index";

async function verify() {
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user'
      ORDER BY column_name;
    `;
    console.log("Columns in 'user' table:");
    console.table(columns);

    // Check for specific columns
    const columnNames = (columns as Array<{ column_name: string }>).map(
      (c) => c.column_name,
    );
    const expectedColumns = [
      "isDeleted",
      "role",
      "currentStreak",
      "longestStreak",
      "lastWorkoutDate",
    ];

    for (const col of expectedColumns) {
      if (columnNames.includes(col)) {
        console.log(`✅ Column '${col}' exists.`);
      } else {
        console.error(`❌ Column '${col}' IS MISSING!`);
      }
    }
  } catch (error) {
    console.error("Verification failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
