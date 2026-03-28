Analytics Implementation Plan
The objective is to implement a comprehensive analytics engine for Kora, spanning Phase 1 (Core Metrics), Phase 2 (Engagement & History), and Phase 3 (Heatmaps & Advanced Analytics). This implementation will span across the local-first Expo application and the NestJS backend, utilizing the centralized @kora/db package for schema definition.

User Review Required
IMPORTANT

This plan outlines significant schema additions to track workout metrics and durations granularly. Please review the new database models and ensure they align with your vision. If accepted, I will begin implementing Phase 1 in EXECUTION mode.

Proposed Changes
@kora/db (Database Schema)
The core of the analytics system is based on robust data tracking. We will update the schema to support detailed workout sessions.

[MODIFY] packages/db/schema.ts
Add fields to UserProfile (or create it if it doesn't exist) for age, height, weight, gender, bmr, and tdee.
Create WorkoutSession table:
id (uuid)
userId (uuid)
timestampStart (datetime)
timestampEnd (datetime)
totalDurationSeconds (integer)
successPercent (integer)
fatigueLevel (integer - RPE)
totalVolume (integer)
Create WorkoutSet table:
id (uuid)
sessionId (uuid, relation)
exerciseId (uuid)
reps (integer)
weightKg (real)
rpe (integer)
restTimeSeconds (integer)
repDurationsSeconds (jsonb or text array) - To track velocity/duration per rep.
apps/server (NestJS Backend)
The backend needs to handle syncing these metrics and providing aggregations for the frontend.

[MODIFY] apps/server/src/sync/sync.service.ts
Update the sync engine schema mapping to ensure the new WorkoutSession and WorkoutSet tables are pulled/pushed efficiently during offline sync.
[NEW] apps/server/src/analytics/analytics.service.ts
Add logic to compute Streaks: calculate the current and longest streak from the WorkoutSession timestamps.
Add logic to compute Metabolic Rates (BMR/TDEE) whenever profile parameters (weight, age, etc.) are updated via the Mifflin-St Jeor formula.
Add aggregation endpoints for Heat Maps: summarizing totalVolume grouped by target_muscle_group and dates.
Expo Frontend (React Native)
The frontend needs UI components to capture the detailed data and visualize the analytics.

[MODIFY] apps/native/app/workout/session.tsx
Update the active workout screen.
Start a global timer when the workout begins to accurately track totalDurationSeconds.
Implement a Rest Timer that starts after completing a set. It records restTimeSeconds when the next set begins.
Implement Rep Timers (optional UI, but captured logic) to record repDurationsSeconds if utilizing a velocity-based UI or explicit rep presses. (Wait for user confirmation on how manual/automatic rep tracking should feel).
[NEW] apps/native/components/analytics/Heatmap.tsx
Build the Muscle Distribution body map renderer.
Build the GitHub-style contribution graph using a library like react-native-calendar-heatmap.
[NEW] apps/native/app/profile/index.tsx
Build the UI for users to update Age, Height, Weight, and Gender, and display their calculated TDEE.
Verification Plan
Automated Tests
Run pnpm turbo -F @kora/db db:generate and db:migrate to ensure schema changes apply cleanly.
Add backend unit tests in apps/server/src/analytics/analytics.service.spec.ts to verify BMR/TDEE formulas output the mathematically correct values (e.g., passing known variables to the Mifflin-St Jeor function).
Manual Verification
Run pnpm dev to launch the Expo app and backend.
Navigate to the Profile tab and update age/height/weight. Verify the BMR/TDEE updates on the screen.
Start a mock workout session. Log 2 sets, intentionally wait 15 seconds between them. Finish the workout.
Verify the database stores the correct totalDurationSeconds and records restTimeSeconds: 15 on the second set.
