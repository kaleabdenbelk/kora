# Front-End Implementation Requirements (Analytics)

This document outlines the front-end requirements for the Kora Analytics Engine (Phases 1-3) based on the backend "Engine" implementation.

## Phase 1: Core Metrics & Profile
- **Input Fields**: Ensure `Weight` (kg), `Height` (cm), `Age`, and `Gender` are captured in the onboarding/profile flow.
- **Session Timers**:
  - Global Session Timer: Start when workout begins, end when session completes.
  - Rest Timer: Start after completing a set. Record "actual rest duration" for the *preceding* set when the *next* set begins.
  - Rep Timer (Optional/Future): Start/Stop on each rep or use aggregate duration for the set divided by reps.
- **Success Criteria**: Calculate `actualSets / plannedSets * 100` for `successPercent`.

## Phase 2: Engagement & Best-Of
- **Streak Display**: Pull `currentStreak` and `longestStreak` from the analytics dashboard endpoint.
- **Personal Records**:
  - Implement a "Best Of" list using values from `GET /analytics/:userId/personal-records`.
  - Display max weight and 1RM for key compound movements (Bench, Squat, Deadlift, etc.).

## Phase 3: Advanced Visualizations
- **Muscle Distribution (Radar Chart)**:
  - Map muscle group percentages to the `RadarChart` component from `GET /analytics/:userId/muscle-distribution`.
- **Activity Heatmap (GitHub-style)**:
  - Use `react-native-calendar-heatmap` or similar to display workout frequency from `GET /analytics/:userId/heatmap`.
  - Frequency is returned as a mapping of `YYYY-MM-DD` to `count`.
- **Workout History (List)**:
  - Display a scrollable list of recent sessions from `GET /analytics/:userId/history`.
  - Each item should show: Date, Title (from `planned.split`), Duration, Success %, and Volume.
- **Workout Focus (Pie Chart)**:
  - Breakdown splits (Push/Pull/Legs) based on `GET /analytics/:userId/workout-focus`.
