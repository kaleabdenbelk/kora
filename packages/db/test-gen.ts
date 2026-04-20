import { PrismaClient } from '@prisma/client';
import { PlanService } from '../api/src/services/plan.service';

const prisma = new PrismaClient();

async function main() {
  const userId = "pYGuEPTM5T3rLdmfK5TCKdmLLhaSWj9Z";
  console.log("Generating plan for", userId);
  const planService = new PlanService();
  try {
    await planService.generatePlan(userId);
    console.log("Success");
  } catch (err) {
    console.error("Failed:", err);
  }
}

main().finally(() => prisma.$disconnect());
