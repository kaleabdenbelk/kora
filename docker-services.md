# Kora Docker Services

This file keeps track of all the Docker containers and images required to run the Kora project locally, including their ports and how to start them.

## 1. Services Managed by Docker Compose
These are defined in the `docker-compose.yml` file and can be started together by running:
```bash
docker compose up -d
```

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| **Database** | `postgres:16-alpine` | `5432` | Main PostgreSQL database for the application. |
| **MinIO** | `minio/minio:latest` | `9000` (API), `9001` (Console) | AWS S3-compatible local file storage. |

## 2. Standalone Docker Services
These services are run via standalone Docker commands. You must run these manually if they are not running.

### Redis (For BullMQ / Background Jobs)
If you don't have Redis installed natively on Linux, run it via Docker:
```bash
docker run --name kora-redis -p 6379:6379 -d redis
```

### MailHog (For Local Email Testing)
MailHog acts as a fake SMTP server to catch outgoing emails so you can view them locally without needing an AWS SES account.
- **Port 1025:** The SMTP port (where your app sends the emails).
- **Port 8025:** The Web UI port (open `http://localhost:8025` in your browser to see the emails).

Run it with:
```bash
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

---

**Summary Command to start everything (if not using Compose for all):**
```bash
# 1. Start Postgres and MinIO
docker compose up -d

# 2. Start Redis
docker start kora-redis || docker run --name kora-redis -p 6379:6379 -d redis

# 3. Start Mailhog
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
```
