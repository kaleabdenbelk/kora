# Kora API & Security Documentation

This document provides a comprehensive overview of the Kora backend architecture, security measures, rate limiting policies, and the core API surface related to onboarding and plan generation.

---

## 1. Architecture Overview

The Kora backend utilizes a modern, type-safe stack designed for performance and developer experience:

- **NestJS:** Serves as the robust, modular foundation for the application handling traditional HTTP routes, static file serving, and dependency injection.
- **tRPC:** Provides end-to-end type safety between the client and server. It allows the frontend to call API procedures directly without manually writing fetch requests or typing generic REST endpoints.
- **Better Auth:** Manages session-based authentication securely. It seamlessly integrates with database providers (Prisma) and provides a secure session context to requests.
- **Redis (ioredis):** Used primarily as a fast, in-memory data store to handle rate-limiting. This ensures high availability and resilience against abuse or API spamming.

---

## 2. Security & Protection Measures

The platform employs multiple layers of security to verify identity, protect resources, and prevent abuse.

### 2.1 Cross-Origin Resource Sharing (CORS)
The server restricts cross-origin requests by strictly allowing only the predefined `CORS_ORIGIN` environment variable.
- **Allowed Methods:** GET, POST, OPTIONS
- **Allowed Headers:** Content-Type, Authorization
- **Credentials:** True (allows session cookies to be passed between client and server)

### 2.2 Authentication & Authorization
All tRPC procedures that expose sensitive user data or perform state-mutating actions utilize the `protectedProcedure` middleware. It verifies the existence of an active backend session established by Better Auth.
- If no active session exists, the API immediately throws an `UNAUTHORIZED` TRPCError.

### 2.3 Rate Limiting

#### Global Throttling (Standard HTTP)
For standard REST endpoints (e.g., standard login endpoints or generic assets), Kora uses `@nestjs/throttler` combined with `ThrottlerStorageRedisService`. Three distinct throttlers operate automatically:
- **Short:** 3 requests per 1 second.
- **Medium:** 60 requests per 1 minute.
- **Long:** 1000 requests per 1 hour.

#### tRPC Custom Rate Limiting
Because tRPC endpoints bypass standard NestJS controller execution contexts, an independent rate limit middleware (`createRateLimiter`) built on `ioredis` is applied precisely to individual tRPC procedures using `rateLimitedProcedure`.
- Rate limits are stored dynamically in Redis under the key scheme: `ratelimit:{prefix}:{userId}:{path}`.
- Requests violating the threshold immediately fail with a `TOO_MANY_REQUESTS` code.

### 2.4 Plan Duplication Prevention (Race Conditions)
To ensure system integrity when generating a workout plan (which involves heavy database inserts):
- A strict database validation is performed upon calling `plan.generate`. If an *active* `UserPlan` already exists for the querying `userId`, the service halts execution and returns an error: `"User already has an active plan."`
- This prevents dual-submissions or script automated duplicate requests.

---

## 3. API Surface (tRPC)

The core application flow utilizes the following protected tRPC procedures to manage the onboarding and workout plan lifecycle.

### 3.1 Onboarding Router (`onboarding`)

#### `onboarding.get` [Query]
- **Purpose:** Fetches the current user's onboarding profile. 
- **Input:** None (Infers `userId` from context).
- **Protection:** Requires Auth.

#### `onboarding.update` [Mutation]
- **Purpose:** Patches the user's current onboarding profile. Note that completing the necessary profile fields (`goal`, `trainingLevel`, `trainingDaysPerWeek`, `gender`) automatically triggers silent generation of the workout plan using `planService.generatePlan`.
- **Input Object:**
  - `preferredName?` string
  - `gender?` Enum[Male, Female]
  - `age?`, `weight?`, `height?` number
  - `trainingLevel?` Enum[Beginner, Intermediate, Advanced]
  - `trainingDaysPerWeek?` number (1-7)
  - `goal?` Enum[Hypertrophy, Strength, Endurance]
- **Protection:** Requires Auth.
- **Rate Limit (`onboarding:update`):** maximum **10 requests per minute**.

### 3.2 Plan Router (`plan`)

#### `plan.getActive` [Query]
- **Purpose:** Fetches the single currently active `UserPlan` bound to the authenticated user. Includes metadata about the plan and corresponding `UserSession` records.
- **Input:** None.
- **Protection:** Requires Auth.
- **Rate Limit (`plan:read`):** maximum **30 requests per minute**.

#### `plan.generate` [Mutation]
- **Purpose:** Manually triggers generation of a new plan by finding a matching program template based on the user's onboarding metadata and expanding it into a complete user schedule.
- **Input:** None (Infers `userId` and criteria from database state).
- **Protection:** Requires Auth. Fails if user profile lacks criteria. Fails if an active plan already exists.
- **Rate Limit (`plan:gen`):** Highly restricted to a maximum of **1 request per 60 seconds**.
