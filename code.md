# Kora Project Roadmap

This document outlines the steps to improve Kora, moving from the legacy `kora_backend` to the new `kora` architecture.

## 1. Database & Schema Alignment
- **Step**: Merge relevant models from `kora_backend/prisma/schema.prisma` into the new split Prisma schema in `packages/db/prisma/schema/`.
- **Focus**: Ensure `User`, `UserPlan`, `Exercise`, and `UserSession` models are compatible with `BetterAuth`.
- **Why**: Solid foundation for data migration and new feature development.

## 2. API Migration to tRPC
- **Step**: Port core business logic from `kora_backend/src/routes` and `controllers` to `packages/api/src/routers`.
- **Focus**: Implement robust tRPC procedures with Zod validation.
- **Why**: Cleaner, type-safe communication between frontend and backend.

## 3. Rate Limiting Implementation
- **Step**: Add rate limiting to the NestJS/tRPC stack.
- **Focus**: Use `@nestjs/throttler` for global limits and custom tRPC middleware for fine-grained control on sensitive endpoints.
- **Why**: Protect the API from abuse and ensure stability.

## 4. Centralized Analytics Management
- **Step**: Design a dedicated analytics service (possibly a new package `@kora/analytics`).
- **Focus**: Streamline tracking of user progress, session completion, and plan effectiveness.
- **Why**: Better insights into user behavior and system performance.

## 5. Template-Based Plan Generation
- **Step**: Refactor the workout generation logic to be primarily template-based.
- **Focus**: Utilize `TemplatePlan` models to provide curated experiences while keeping the `engines` as fallback or for minor adjustments.
- **Why**: Simplifies the generation logic and ensures high-quality plans for users.

## 6. Background Jobs & Notification Improvements
- **Step**: Enhance `BullMQ` integration for plan generation and email notifications (AWS SES).
- **Focus**: Move heavy lifting (like plan PDF generation or complex analytics aggregation) to background jobs.
- **Why**: Improve API responsiveness and user experience.
