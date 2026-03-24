import type { Request, Response, NextFunction } from "express";

import { createContext } from "@kora/api/context";
import { appRouter } from "@kora/api/routers/index";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

@Injectable()
export class TrpcMiddleware implements NestMiddleware {
  private trpcMiddleware = createExpressMiddleware({
    router: appRouter,
    createContext,
  });

  use(req: Request, res: Response, next: NextFunction) {
    this.trpcMiddleware(req, res, next);
  }
}
