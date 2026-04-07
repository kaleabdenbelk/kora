# Kora API Documentation

The Kora backend serves its API over a strictly-typed **tRPC** routing layer. By default, it runs over `http://localhost:3000/trpc` and consumes JSON payloads over HTTP. All endpoints below explicitly implement rate-limiting and internal authorization guards ensuring absolute user data-isolation (no IDOR vulnerabilities exist since all mutations bind locally to `ctx.session.user.id`).

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
Upserts a user's fundamental body measurements, diet, and training parameters into the database.
- **Method**: `POST /trpc/onboarding.update`
- **Access Level**: Protected
- **Rate Limit**: Max 10 requests per minute
- **Input Payload**: 
  - `preferredName?` (string)
  - `age?` (number)
  - `height?` (number)
  - `weight?` (number)
  - `gender?` (string)
  - `trainingBackground?` (string)
  - `fitnessGoal?` (string)
  - `preferredSchedule?` (number[])
  - `equipmentAvailable?` (string[])
- **Output**: Updated state object.

---

## 3. Plan Generation

### `plan.generate`
Synchronously queries Kora's LLM routing engine to synthesize a fully customized meso-cycle structure based off the user's specific onboarding profile.
- **Method**: `POST /trpc/plan.generate`
- **Access Level**: Protected
- **Rate Limit**: Max 1 request per 60 seconds (Strict calculation limit to avoid LLM spam)
- **Input**: None
- **Output**: Complex nested `Plan` object tree encompassing nested `Blocks`, `Weeks`, and `Days`.

### `plan.getActive`
Retrieves the most recent, active master-plan orchestrating the user's current workout phase.
- **Method**: `GET /trpc/plan.getActive`
- **Access Level**: Protected
- **Rate Limit**: Max 30 requests per minute
- **Input**: None
- **Output**: `Plan`

---

## 4. Exercises

### `exercise.search`
Fuzzy search endpoint running directly against the Prisma `Exercise` registry filtering movements algorithmically by nomenclature.
- **Method**: `GET /trpc/exercise.search`
- **Access Level**: Protected
- **Rate Limit**: Max 30 queries per 60 seconds
- **Input Payload**: 
  - `query` (string, min 1 character)
- **Output**: Array of formatted `Exercise` objects matching the parameter substring.

---

## 5. Progression Engine

### `progression.calculate`
Heuristic engine calculation evaluating muscle progression curves based on set-schema outputs.
- **Method**: `POST /trpc/progression.calculate`
- **Access Level**: Protected
- **Rate Limit**: Max 10 calculation queries per 10 seconds
- **Input Payload**:
  - `exerciseId` (string)
  - `baseWeight` (number)
  - `targetReps` (number) 
  - `repsInReserve` (number)
  - `setReadiness` (number)
- **Output**: Derived metrics indicating the recommended resistance payload.

---

## 6. Analytics (REST Controller)

In addition to the tRPC routing system, Kora relies on a natively secured NestJS Express controller parsing `Better Auth` session-tokens to serve comprehensive historical analytics and charts out-of-the-box. 

### `history`
Fetches a paginated history of all completed workout sessions cleanly.
- **Method**: `GET /api/analytics/history`
- **Query Params**: `limit` (default: 20), `offset` (default: 0)
- **Output**: Session logs, complete with duration and volume tonnage.

### `personal-records`
Calculates and evaluates historical maximums.
- **Method**: `GET /api/analytics/personal-records`
- **Output**: Array of PR details including max weights, exact reps hit, and Brzycki estimated 1RM.

### `summary` & `profile-summary`
Computes an aggregated summary over a designated timeframe. 
- **Method**: `GET /api/analytics/summary` | `GET /api/analytics/profile-summary`
- **Query Params**: `filter` ("Day", "Week", "Month", "Year")
- **Output**: Includes total tonnage moved, duration in active minutes, workouts completed, your BMI statline, and adherence progress percentage.

### `muscles`
Aggregates and chunks total training volume down directly to specific anatomical divisions.
- **Method**: `GET /api/analytics/muscles`
- **Query Params**: `filter`
- **Output**: Exact volume capacities and fractional percentage distribution metrics per muscle group (e.g. Chest: 24%, Back: 30%, Biceps: 8%).

### `trends` & `heatmap`
Fetches strict chronological metrics to chart timelines and daily habit matrices.
- **Method**: `GET /api/analytics/trends` | `GET /api/analytics/heatmap`
- **Query Params**: `metric` ("Tonnage", "Time"), `days`
- **Output**: Data matrices tailored natively for React charting libraries.
