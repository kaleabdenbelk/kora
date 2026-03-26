import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@kora/env/server";

const s3 = new S3Client({
  region: env.AWS_S3_REGION,
  endpoint: env.AWS_S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

async function main() {
  const bucket = env.AWS_S3_BUCKET_NAME;
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Bucket '${bucket}' created successfully.`);
  } catch (error: any) {
    if (
      error.name === "BucketAlreadyOwnedByYou" ||
      error.name === "BucketAlreadyExists"
    ) {
      console.log(`Bucket '${bucket}' already exists.`);
    } else {
      console.error("Error creating bucket:", error);
    }
  }
}

main();
