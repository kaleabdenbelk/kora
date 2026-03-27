import { auth } from "@kora/auth";
import {
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { SyncPayload } from "./sync.service";
import { SyncService } from "./sync.service";

@Controller("api/sync")
export class SyncController {
  constructor(@Inject(SyncService) private readonly syncService: SyncService) {}

  @Post()
  async sync(@Body() body: SyncPayload, @Req() req: any) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      throw new UnauthorizedException("Authentication required for sync");
    }

    return this.syncService.processSync(body, session.user.id);
  }
}
