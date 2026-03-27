import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import { protectedProcedure, requireRole, router } from "../index";
import {
  createRateLimiter,
  setRateLimiterClientForTests,
} from "../middlewares/rate-limit";

describe("Phase 4 auth security", () => {
  it("rejects unauthenticated protected procedure calls", async () => {
    const appRouter = router({
      me: protectedProcedure.query(({ ctx }) => ctx.session.user.id),
    });

    const caller = appRouter.createCaller({ session: null } as any);

    await expect(caller.me()).rejects.toBeInstanceOf(TRPCError);
    await expect(caller.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects users without required role", async () => {
    const appRouter = router({
      adminOnly: requireRole("admin").query(() => "ok"),
    });

    const caller = appRouter.createCaller({
      session: {
        user: { id: "u-1", role: "user" },
      },
    } as any);

    await expect(caller.adminOnly()).rejects.toBeInstanceOf(TRPCError);
    await expect(caller.adminOnly()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows users with required role", async () => {
    const appRouter = router({
      adminOnly: requireRole("admin").query(() => "ok"),
    });

    const caller = appRouter.createCaller({
      session: {
        user: { id: "u-1", role: "admin" },
      },
    } as any);

    await expect(caller.adminOnly()).resolves.toBe("ok");
  });

  it("fails closed when failOpen is false and redis errors", async () => {
    setRateLimiterClientForTests({
      incr: vi.fn().mockRejectedValue(new Error("redis down")),
      pexpire: vi.fn(),
    });

    const middleware = createRateLimiter(1000, 3, "auth", false);
    const next = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      middleware({
        ctx: { session: { user: { id: "u-1" } } },
        path: "auth.login",
        next,
      } as any),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    expect(next).not.toHaveBeenCalled();
  });

  it("fails open when configured and redis errors", async () => {
    setRateLimiterClientForTests({
      incr: vi.fn().mockRejectedValue(new Error("redis down")),
      pexpire: vi.fn(),
    });

    const middleware = createRateLimiter(1000, 3, "auth", true);
    const next = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      middleware({
        ctx: { session: { user: { id: "u-1" } } },
        path: "auth.login",
        next,
      } as any),
    ).resolves.toEqual({ ok: true });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns TOO_MANY_REQUESTS when quota exceeded", async () => {
    setRateLimiterClientForTests({
      incr: vi.fn().mockResolvedValue(4),
      pexpire: vi.fn().mockResolvedValue(1),
    });

    const middleware = createRateLimiter(1000, 3, "auth", true);

    await expect(
      middleware({
        ctx: { session: { user: { id: "u-1" } } },
        path: "auth.login",
        next: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
