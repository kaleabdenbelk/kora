# Bodyweight & Muscle Analytics System

This document explains how Kora calculates workout analytics, specifically focusing on the shift from equal muscle distribution to a **Weighted Role-Based System**.

## 1. Core Concepts

### Volume Calculation
For every exercise log, volume is calculated as:
`Volume = Σ (Weight * Reps)` for each set.

> [!NOTE]
> For pure bodyweight exercises, the `weight` should ideally be the user's current bodyweight. If logged as `0kg` in the app, the engine currently treats it as 0 volume. Ensure the frontend passes the user's weight or a placeholder for bodyweight-only movements.

### Muscle Role Weights
Kora uses a weighted allocation system to ensure analytics reflect the actual focus of an exercise. Every muscle connected to an exercise has a **Role**, which determines how much "volume credit" it receives:

| Role | Weight | Description |
|---|---|---|
| **PRIMARY** | **1.0** | The main muscle targeted by the movement (e.g., Quads in a Squat). |
| **SECONDARY** | **0.5** | Major supporting muscles (e.g., Triceps in a Bench Press). |
| **STABILIZER** | **0.2** | Muscles used for balance or minor support (e.g., Core in a Pull-up). |

---

## 2. Calculation Logic

When the `AnalyticsService` calculates the muscle distribution for a period:

1.  **Total Log Volume**: We calculate the raw volume of an exercise log.
2.  **Exercise Weight Sum**: We sum the weights of all muscles involved based on their roles.
    *   *Example (Bench Press)*: Pectorals (Primary=1.0) + Triceps (Secondary=0.5) + Anterior Deltoid (Secondary=0.5) = **2.0 total weight**.
3.  **Proportional Allocation**: The log volume is divided proportionally.
    *   **Pectorals** receive `(1.0 / 2.0) = 50%` of the volume.
    *   **Triceps** receive `(0.5 / 2.0) = 25%` of the volume.
    *   **Anterior Deltoid** receive `(0.5 / 2.0) = 25%` of the volume.

This ensures that "Primary" muscles stand out in the charts, solving the issue of "dummy-like" repeating data.

---

## 3. Frontend Integration

The frontend should access these analytics through the **Analytics Router** via tRPC hooks.

### Accessing Muscle Distribution
Use the `getMuscleDistribution` query to get a breakdown of muscle focus over a specific time range.

```typescript
const { data: distribution } = trpc.analytics.getMuscleDistribution.useQuery({
  days: 30 // Last 30 days
});

// Example Response Format:
// {
//   "Quadriceps": { "volume": 12500, "percentage": 42.5 },
//   "Gluteus Maximus": { "volume": 8000, "percentage": 27.2 },
//   ...
// }
```

### Display Recommendations
*   **Visual Excellence**: Use the `percentage` field to render Muscle Heatmaps or Radar Charts.
*   **Dynamic UI**: Since the percentages are now role-weighted, your "Top Muscle Group" widget will accurately show the largest mover (e.g., "Legs") rather than showing all leg-adjacent muscles at 20%.

---

## 4. Advanced Overrides

If a specific exercise needs more precision than the default role weights:
*   **`activationMultiplier`**: In the `ExerciseMuscle` database model, you can set an `activationMultiplier` (e.g., `0.7`). If this field is anything other than `1.0`, the engine will use it as the weight instead of the role-based default.
