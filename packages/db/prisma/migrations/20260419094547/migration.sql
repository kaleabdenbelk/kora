-- CreateEnum
CREATE TYPE "PlanSource" AS ENUM ('AI_GENERATED', 'CUSTOM');

-- AlterTable
ALTER TABLE "user_plans" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "source" "PlanSource" NOT NULL DEFAULT 'AI_GENERATED';

-- CreateTable
CREATE TABLE "personal_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "maxWeightKg" DOUBLE PRECISION NOT NULL,
    "reps" INTEGER NOT NULL,
    "estimated1RM" DOUBLE PRECISION,
    "maxVolume" DOUBLE PRECISION,
    "sessionId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_caloric_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "basalBurn" DOUBLE PRECISION NOT NULL,
    "workoutBurn" DOUBLE PRECISION NOT NULL,
    "activeBurn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBurn" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_caloric_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_records_userId_idx" ON "personal_records"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "personal_records_userId_exerciseId_key" ON "personal_records"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "daily_caloric_logs_userId_idx" ON "daily_caloric_logs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_caloric_logs_userId_date_key" ON "daily_caloric_logs"("userId", "date");

-- CreateIndex
CREATE INDEX "user_plans_userId_isActive_idx" ON "user_plans"("userId", "isActive");

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_caloric_logs" ADD CONSTRAINT "daily_caloric_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
