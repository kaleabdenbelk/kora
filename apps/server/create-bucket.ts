import {
  CreateBucketCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "@kora/env/server";

const s3 = new S3Client({
  region: env.AWS_S3_REGION ?? "us-east-1",
  endpoint: env.AWS_S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.AWS_S3_ACCESS_KEY_ID ?? "minioadmin",
    secretAccessKey: env.AWS_S3_SECRET_ACCESS_KEY ?? "minioadmin",
  },
});

async function main() {
  const bucket = env.AWS_S3_BUCKET_NAME;
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Bucket '${bucket}' created successfully.`);
  } catch (error: unknown) {
    const name =
      error instanceof Error
        ? ((error as NodeJS.ErrnoException).code ?? error.name)
        : undefined;
    if (name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists") {
      console.log(`Bucket '${bucket}' already exists.`);
    } else {
      console.error("Error creating bucket:", error);
      return;
    }
  }

  try {
    console.log(`Applying CORS policy to bucket '${bucket}'...`);
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
              AllowedOrigins: ["*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      }),
    );
    console.log("CORS policy applied successfully.");
  } catch (error) {
    console.error("Error applying CORS policy:", error);
  }
}

main();
