# Kora API Documentation
 
 The Kora backend serves its API over a strictly-typed **tRPC** routing layer. By default, it runs over `http://localhost:3000/trpc` and consumes JSON payloads over HTTP. All endpoints below explicitly implement rate-limiting and internal authorization guards ensuring absolute user data-isolation.
 
 ---
 
 ## 1. System
 
 ### `healthCheck`
 Endpoint testing to confirm backend uptime and reachability.
 - **Method**: `GET /trpc/healthCheck`
 - **Access Level**: Public
 - **Rate Limit**: None
 - **Input**: None
 - **Output**: `"OK"`
 
 ---
 
 ## 2. Onboarding
 
 ### `onboarding.get`
 Retrieves the logged-in user's profile and physiological setup parameters.
 - **Method**: `GET /trpc/onboarding.get`
 - **Access Level**: Protected (Requires valid user session)
 - **Rate Limit**: None
 - **Input**: None
 - **Output**: `OnboardingSchema` Object
 
 ### `onboarding.update`
 Upserts a user's fundamental body measurements, diet, and training parameters. Automatically triggers metabolic rate (BMR/TDEE) recalculation and plan generation if profile is complete.
 - **Method**: `POST /trpc/onboarding.update`
 - **Access Level**: Protected
 - **Rate Limit**: Max 10 requests per minute
 - **Input Payload**: 
   - `preferredName?` (string)
   - `age?` (number)
   - `height?` (number)
   - `weight?` (number)
   - `gender?` ("MALE" | "FEMALE" | "OTHER")
   - `trainingBackground?` (string)
   - `fitnessGoal?` (string)
   - `preferredSchedule?` (number[])
   - `equipmentAvailable?` (string[])
 - **Output**: Updated state object.
 
 ---
 
 ## 3. Plan Generation
 
 ### `plan.generate`
 Synchronously queries Kora's LLM routing engine to synthesize a fully customized meso-cycle structure.
 - **Method**: `POST /trpc/plan.generate`
 - **Access Level**: Protected
 - **Rate Limit**: Max 1 request per 60 seconds
 - **Input**: None
 - **Output**: Complex nested `Plan` object tree.
 
 ### `plan.getActive`
 Retrieves the most recent, active master-plan.
 - **Method**: `GET /trpc/plan.getActive`
 - **Access Level**: Protected
 - **Rate Limit**: Max 30 requests per minute
 - **Input**: None
 - **Output**: `Plan`
 
 ---
 
 ## 4. Exercises
 
 ### `exercise.search`
 Fuzzy search endpoint for movements.
 - **Method**: `GET /trpc/exercise.search`
 - **Access Level**: Protected
 - **Rate Limit**: Max 30 queries per 60 seconds
 - **Input Payload**: 
   - `query` (string, min 1 character)
 - **Output**: Array of formatted `Exercise` objects.
 
 ### `plan.getById` [Query]
 Fetches full details for a specific plan.
 - **Input:** `{ planId: string }`
 - **Output:** `UserPlan` object with `sessions`.
 
 ### `plan.list` [Query]
 Lists all plans for the authenticated user.
 - **Output:** Array of plan objects.
 
 ---
 
 ## 5. Progression Engine
 
 ### `progression.calculate`
 Heuristic engine calculation evaluating muscle progression curves.
 - **Method**: `POST /trpc/progression.calculate`
 - **Access Level**: Protected
 - **Rate Limit**: Max 10 queries per 10 seconds
 - **Input Payload**:
   - `exerciseId` (string)
   - `baseWeight` (number)
   - `targetReps` (number) 
   - `repsInReserve` (number)
   - `setReadiness` (number)
 - **Output**: Derived metrics for recommended resistance.
 
 ---
 
 ## 6. Analytics
 
 Kora provides a robust analytics engine accessible through both a **tRPC** router (`analytics`) and a natively secured **NestJS Express** controller for REST clients.
 
 ### REST Controller (`/api/analytics/...`)
 Access: Protected. Response structure: `{ success: true, data: { ... } }`
 
 | Endpoint | Method | Query Params | Description |
 | :--- | :--- | :--- | :--- |
 | `history` | GET | `limit`, `offset` | Paginated workout session history. |
 | `summary` | GET | `filter` ("Day", "Week", "Month", "Year") | Period totals (tonnage, duration, calories). |
 | `profile-summary` | GET | None | Lifetime stats, BMI, and best-of PR records. |
 | `muscles` | GET | `filter` | Muscle group volume distribution percentages. |
 | `trends` | GET | `metric`, `filter` | Time-series data for charting (Tonnage, Time, Calories). |
 | `heatmap` | GET | `days` (default 180) | Habit matrix data (date/count pairs). |
 | `streak` | GET | None | Current and longest training streaks. |
 | `personal-records`| GET | None | Historical maximums and estimated 1RM. |
 
 ### tRPC Router (`router.analytics`)
 All analytics logic is mirrored in the `analytics` tRPC router for seamless frontend integration with full type-safety.
 - `getDashboardStats`: Aggregated metrics for the Home screen dashboard.
 - `getTrends`: `{ metric: string, filter: string }`
 - `getMuscleDistribution`: `{ days: number }`
 - `getActivityHeatmap`: `{ days: number }`
 - `getWorkoutHistory`: `{ page: number, limit: number }`
 - `getProfileSummary`: Aggregated stats and athlete profile summary.
 
 ---
 
 ## 7. Workouts
 
 ### `workout.save`
 Submission endpoint for completing a workout session. Triggers progression and analytics engines.
 - **Method**: `POST /trpc/workout.save`
 - **Access Level**: Protected
 - **Rate Limit**: Max 5 submissions per minute
 - **Input Payload**:
   - `sessionId` (string)
   - `completedAt` (string, ISO-8601)
   - `fatigue` (number, 1-10)
   - `totalDurationSeconds` (number)
   - `activeMinutes` (number)
   - `exercises` (Array of set logs)
 - **Output**: `{ success: true, sessionId: string }`
 
 ---
 
 ## 8. Exercise Discovery
 
 ### `exercise.browse`
 Advanced discovery endpoint for building custom plans.
 - **Method**: `GET /trpc/exercise.browse`
 - **Output**: Detailed exercise list matching filters.
 
 ### `exercise.getById`
 Retrieves full details for a single movement.
 - **Method**: `GET /trpc/exercise.getById`
 - **Output**: `Exercise` object.
 
 ### `exercise.toggleSave`
 Toggles the saved/bookmarked status of an exercise.
 - **Method**: `POST /trpc/exercise.toggleSave`
 - **Input**: `{ exerciseId: string, save: boolean }`
 - **Output**: Updated state.
 
 ### `exercise.getSaved` / `exercise.isSaved`
 Retrieve or check saved status for movements.
