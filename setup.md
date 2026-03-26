# Kora Project Setup & Start Guide

This guide provides step-by-step instructions to get your local development environment running again after restarting your PC.

## 1. Start Infrastructure (Postgres & MinIO)
The PostgreSQL database and MinIO (AWS S3-compatible storage) are managed via Docker Compose.

Open your terminal in the `kora` root directory and run:
```bash
docker compose up -d
```
- **Postgres** will run on port `5432`.
- **MinIO** API will run on port `9000`, and its web console on `9001` (Credentials: `minioadmin` / `minioadmin`).

## 2. Start Redis
Redis is required for the application queues (BullMQ) but is **not** included in the current `docker-compose.yml`. 

If you installed Redis natively on Linux, it might already be running. If not, start it:
```bash
sudo systemctl start redis
```

If you prefer to run Redis via Docker, you can start a quick container:
```bash
docker run --name kora-redis -p 6379:6379 -d redis
```

## 3. Start the Application (Turborepo)
Once the databases and services (Postgres, MinIO, Redis) are running, you can start the development servers.

Make sure you are in the root directory and your dependencies are installed (`pnpm install`), then run:
```bash
pnpm dev
```
This command uses Turbo to start all applications (`web`, `server`, etc.) in development mode.

**Alternative target scripts:**
- Start only the server: `pnpm dev:server`
- Start only the web app: `pnpm dev:web`
- Start only the native app: `pnpm dev:native`

## 4. Useful Commands & Verification

- **Check Redis:** Run your test script to ensure BullMQ connects cleanly:
  ```bash
  npx tsx apps/server/test-redis.ts
  ```
- **Database Studio:** View and edit your Postgres data via Prisma Studio:
  ```bash
  pnpm db:studio
  ```
- **Prisma Migrations:** If you pulled new schema changes, update the database and client:
  ```bash
  pnpm db:generate
  pnpm db:push
  ```

 sudo docker compose up -d
"sudo docker compose up -d db minio"
"pnpm dlx tsx packages/db/prisma/seed.ts"
"pnpm run dev"


redis fails
sudo docker start kora-redis

postgress fails and the system is running postgress
 sudo lsof -i :5432

sudo systemctl stop postgresql

if its running docker 

sudo docker stop <container_id> the one using 5432