import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  deleteFile,
  getDownloadUrl,
  getUploadUrl,
  listFiles,
  uploadFile,
} from "../lib/storage";

@Controller("s3-test")
export class S3TestController {
  @Get("health")
  async health() {
    try {
      const result = await listFiles("health-check/", { maxKeys: 1 });
      return { status: "ok", bucket: process.env.AWS_S3_BUCKET_NAME, result };
    } catch (err) {
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  @Get("list")
  async list() {
    const result = await listFiles();
    return result;
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @UploadedFile()
    file: { originalname: string; buffer: Buffer; mimetype: string },
  ) {
    const key = `uploads/${Date.now()}-${file.originalname}`;
    const result = await uploadFile(key, file.buffer, {
      contentType: file.mimetype,
    });
    const url = await getDownloadUrl(key, { expiresIn: 3600 });
    return { ...result, url };
  }

  @Get("presign-upload")
  async presignUpload() {
    const key = `uploads/${Date.now()}-test.txt`;
    const url = await getUploadUrl(key, {
      contentType: "text/plain",
      expiresIn: 300,
    });
    return { key, url };
  }

  @Get("download/:key")
  async download(@Param("key") key: string) {
    const url = await getDownloadUrl(decodeURIComponent(key));
    return { url };
  }

  @Delete(":key")
  async remove(@Param("key") key: string) {
    await deleteFile(decodeURIComponent(key));
    return { deleted: true };
  }
}
