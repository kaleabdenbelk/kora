import { env } from "./packages/env/src/server.ts";
console.log("Env validated successfully!");
console.log("NODE_ENV:", env.NODE_ENV);
process.exit(0);
