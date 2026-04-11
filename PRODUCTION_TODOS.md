# Production Security Checklist

These tasks must be completed before deploying the application to a production environment.

## 1. CORS Configuration
Currently, both the API and the Storage Bucket have permissive CORS settings (`*`) to facilitate local development across different devices and browsers.

- [ ] Lock down NestJS CORS to specifically allowed production origins in `apps/server/src/index.ts`.
- [ ] Lock down Better-Auth `trustedOrigins` in `packages/auth/src/index.ts`.
- [ ] Update Storage Bucket CORS policy to restrict `AllowedOrigins` to your production domain(s) in `apps/server/create-bucket.ts`.

## 2. Environment Variables
- [ ] Ensure all API keys and secrets are migrated to a secure environment manager (e.g., Heroku Config Vars, Vercel Env, or a Vault).
- [ ] Verify `CORS_ORIGIN` matches the production frontend URL.
- [ ] Verify `BETTER_AUTH_URL` matches the production backend URL.

## 3. Database & Storage
- [ ] Ensure database SSL is enabled.
- [ ] Confirm storage bucket permissions (Public vs. Private) are correctly set for production assets.
