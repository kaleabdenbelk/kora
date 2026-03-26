# Kora Engine Documentation

Kora uses specialized engines to handle complex workout logic, progression, and volume mapping.

## Progression Engine
The `ProgressionEngine` is responsible for evolving a user's workout based on their performance history and physiological state.

### How It Works
It uses a **Double Progression Model** taking inspiration from elite strength coaching:
1. **Performance Check**: It analyzes the latest completed workout for a specific exercise.
2. **Double Progression**:
   - If all sets hit the maximum prescribed reps with low RPE (< 9): **Increase Weight** (reset reps).
   - If some sets hit max but others didn't: **Maintain Weight** (aim for more reps).
   - If performance dropped: **Maintain/Deload** (focus on technique).
3. **Fatigue Feedback**: Integrates overall session fatigue into the decision. High fatigue (> 8) will trigger a "Safety Hold" (maintaining weight even if reps were hit).

### Inputs (ProgressionOptions)
- `plannedSets`: number (e.g., 3)
- `plannedReps`: string (e.g., "8-12")
- `lastFatigue`: number (1-10, optional)

### Security & Robustness
- **Zod Validation**: Strict schema validation for all inputs.
- **Bounds Checking**: Weight increments are capped at **5kg** per session to prevent dangerous jumps.
- **Safe Deloading**: Automatically detects high-intensity failure (RPE 10+) and suggests technical focus.
- **Data Integrity**: Sanitizes historical data (filters out NaN/Negative values) before calculation.

---

## Plan Service (Orchestrator)
While not a pure "engine," the `PlanService` orchestrates the generation of complex training blocks.

### Logic
1. **Profile Analysis**: Reads user goal, level, and equipment environment.
2. **Template Selection**: Filters `ProgramTemplate` based on user data.
3. **Compilation**: Maps exercises and volume to the user's weekly schedule.

---

## When Engines Run
- **Onboarding Update**: Triggers initial plan generation.
- **Workout Conclusion**: (Upcoming) Triggers `ProgressionEngine` to set targets for the next session.
- **Manual Regen**: Triggered via `plan.generate` API.
