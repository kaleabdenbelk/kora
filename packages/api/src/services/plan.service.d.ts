export declare class PlanService {
    /**
     * Generates a workout plan based on the user's onboarding data.
     */
    generatePlan(userId: string): Promise<{
        id: string;
        programId: string | null;
        createdAt: Date;
        updatedAt: Date;
        isDeleted: boolean;
        userId: string;
        planJson: import("@prisma/client/runtime/client").JsonValue | null;
        startDate: Date;
        endDate: Date | null;
    }>;
    getActivePlan(userId: string): Promise<({
        sessions: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isDeleted: boolean;
            userId: string;
            completedStatus: boolean;
            planId: string;
            dayNumber: number;
            week: number;
            planned: import("@prisma/client/runtime/client").JsonValue;
            completed: import("@prisma/client/runtime/client").JsonValue | null;
            startedAt: Date | null;
            completedAt: Date | null;
            fatigue: number | null;
            totalDurationSeconds: number | null;
            activeMinutes: number | null;
            successPercent: number | null;
            totalVolumeKg: number | null;
        }[];
    } & {
        id: string;
        programId: string | null;
        createdAt: Date;
        updatedAt: Date;
        isDeleted: boolean;
        userId: string;
        planJson: import("@prisma/client/runtime/client").JsonValue | null;
        startDate: Date;
        endDate: Date | null;
    }) | null>;
}
