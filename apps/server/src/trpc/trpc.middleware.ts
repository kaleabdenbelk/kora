import { createContext } from "@kora/api/context";
import { appRouter } from "@kora/api/routers/index";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class TrpcMiddleware implements NestMiddleware {
  private trpcMiddleware = createExpressMiddleware({
    router: appRouter,
    createContext: (opts) => createContext(opts),
  });

  use(req: Request, res: Response, next: NextFunction) {
    this.trpcMiddleware(req, res, next);
  }
}
