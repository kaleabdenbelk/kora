import path from "node:path";
import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

async function test() {
  console.log(
    `Connecting to Redis at ${connection.host}:${connection.port}...`,
  );
  const queue = new Queue("test-connection", { connection });

  try {
    const client = await queue.client;
    await client.ping();
    console.log("✅ Redis connection successful!");
  } catch (err) {
    console.error("❌ Redis test failed:", err);
  } finally {
    await queue.close();
  }
}

test();
