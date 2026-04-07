import { initTRPC, TRPCError } from "@trpc/server";
import type { OpenApiMeta } from "trpc-openapi/dist/index.js";

import type { Context } from "./context";
import { createRateLimiter } from "./middlewares/rate-limit";

export const t = initTRPC.context<Context>().meta<OpenApiMeta>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

function logAuthzAudit(event: string, data: Record<string, unknown>) {
  console.warn(
    "[AUDIT_AUTHZ]",
    JSON.stringify({
      at: new Date().toISOString(),
      event,
      ...data,
    }),
  );
}

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    logAuthzAudit("unauthenticated_access_denied", {
      reason: "missing_session",
    });
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const requireRole = (roles: string | string[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    const userRole = (ctx.session.user as { role?: string }).role || "user";

    if (!allowedRoles.includes(userRole)) {
      logAuthzAudit("role_access_denied", {
        userId: ctx.session.user.id,
        userRole,
        requiredRoles: allowedRoles,
      });
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to access this resource",
      });
    }
    return next({ ctx });
  });

// A protected procedure with a customizable rate limit
export const rateLimitedProcedure = (
  windowMs: number,
  maxRequests: number,
  prefix = "std",
  failOpen = true,
) =>
  protectedProcedure.use(
    createRateLimiter(windowMs, maxRequests, prefix, failOpen),
  );
