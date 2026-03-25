import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { S3TestController } from "./s3-test.controller";

@Module({
  imports: [MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } })],
  controllers: [S3TestController],
})
export class S3TestModule {}
