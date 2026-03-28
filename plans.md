# Analytics & Data Tracking Plan

## Phase 1: Core Metrics & Profile Calculation
**Objective**: Establish base user metrics and reliable daily workout logging.

- **User Profile Updates**: Collect and allow updates for Age, Height, Weight, and Gender.
- **Metabolic Rates (BMR & TDEE)**: Use the Mifflin-St Jeor formula to calculate Baseline Metabolic Rate, and multiply by activity multiplier to get Estimated Daily Requirements (TDEE).
- **Calories**: Calculate and track daily estimated caloric burn vs requirements based on workouts and basal rate.
- **Daily Workout Data Capture Payload**:
  When a user works out in a day, we will capture and store the following object:
  ```json
  {
    "session_id": "uuid",
    "timestamp_start": "ISO-8601",
    "timestamp_end": "ISO-8601",
    "total_duration_seconds": 4500, // exact time taken for the entire workout
    "active_hours": 1.25, // duration in hours/minutes (derived)
    "success_percent": 95, // calculated based on planned reps/sets vs actual completed
    "fatigue_level": 7, // User reported RPE for the session
    "total_volume": 6500, // Total tonnage lifted
    "exercises": [
      {
        "exercise_id": "uuid",
        "name": "Flat Barbell Bench Press",
        "target_muscle_group": "Chest",
        "sets_completed": [
           {
             "reps": 6, 
             "weight_kg": 62, 
             "rpe": 8,
             "rest_time_seconds": 180, // how long they rested after this set
             "rep_durations_seconds": [3.2, 3.5, 4.0, 4.5, 5.2, 6.1] // time taken for each individual rep
           }
        ]
      }
    ]
  }
  ```

## Phase 2: Engagement, History, & Milestones
**Objective**: Build user habituation and gamify progress tracking.

- **Streaks System**: 
  - Track `current_streak` (consecutive workout days/weeks depending on plan).
  - Track `longest_streak` and `last_workout_date`.
- **History Logs**: Clean, scrollable feed of past workouts (showing active hours, total volume, and exercises).
- **Personal Records (Best of)**: Track absolute max weight, estimated 1-Rep Maxes, and total volume PRs for main exercises.
- **Exercise Numbers**: Lifetime stats (e.g., "Total Workouts Completed: 42", "Total Tonnage Lifted: 100,000kg").

## Phase 3: Advanced Analytics & Visualizations
**Objective**: Provide deep insights into user performance and body changes.

- **Heat Maps**:
  - *Muscle Distribution Map*: A visual body diagram highlighting which muscles were trained most frequently/intensely over the last 7, 30, or 90 days.
  - *Activity Heatmap*: A GitHub-style contribution graph showing workout consistency across the year.
- **Workout Focus Percentage**: Chart breakdowns of training splits (e.g., 40% Push, 30% Pull, 30% Legs).
- **Body Metrics Tracking**: Plot user weight over time, log body part measurements (arms, waist, etc.), and map it against their success percent.
