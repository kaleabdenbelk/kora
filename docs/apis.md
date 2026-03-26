# Kora API Documentation

Comprehensive guide to Kora's tRPC APIs, including types, security, and rate limiting.

## Overview
Kora's backend is powered by **tRPC**, ensuring type safety from server to client. Most procedures require authentication and are subjected to specific rate limits to prevent abuse.

---

## Authentication & Security
All APIs documented as **Protected** require a valid session.
- **Middleware**: `protectedProcedure`
- **Mechanism**: Better-Auth session validation.
- **Failure**: Returns `UNAUTHORIZED (401)` if no session is found.

---

## Rate Limiting
Rate limiting is applied at the procedure level using Redis.
- **Middleware**: `rateLimitedProcedure(windowMs, maxRequests, prefix)`
- **Failure**: Returns `TOO_MANY_REQUESTS (429)` if the limit is exceeded.

---

## Routers

### Onboarding Router
Handles user profile setup and initial preferences.

#### `get`
- **Access**: Protected
- **Type**: Query
- **Description**: Retrieves the current user's onboarding profile.
- **Returns**: `Onboarding` object or `null`.

#### `update`
- **Access**: Protected + Rate Limited (10 req / 1 min)
- **Type**: Mutation
- **Input**:
  - `preferredName`: string (optional)
  - `gender`: Gender (optional)
  - `age`: number (13-120)
  - `weight`: number (positive)
  - `trainingDaysPerWeek`: number (1-7)
  - `goal`: TrainingGoal (zod enum)
  - ... (see `onboarding.ts` for full schema)
- **Description**: Updates user profile. If the profile is complete (Goal, Level, Days, Gender), it automatically triggers initial plan generation.
- **Returns**: Updated `Onboarding` object.

---

### Plan Router
Manages workout plans and session generation.

#### `generate`
- **Access**: Protected + Rate Limited (1 req / 1 min)
- **Type**: Mutation
- **Description**: Triggers the `PlanService` to generate a personalized workout plan based on the user's latest onboarding data.
- **Security**: Strict rate limit (1/min) to prevent heavy engine calculations from overloading the server.
- **Returns**: `UserPlan` object.

#### `getActive`
- **Access**: Protected + Rate Limited (30 req / 1 min)
- **Type**: Query
- **Description**: Fetches the currently active plan for the user.
- **Returns**: `UserPlan` with includes (sessions, etc.).
