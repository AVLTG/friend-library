# BookShare - Friends Library

A cozy, interactive book-sharing app for friend groups. Browse visual bookshelves, track who owns what, share reviews and ratings.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Turso credentials, application origin, and a JWT secret (min 32 bytes).

3. **Apply database migrations**
   ```bash
   npm run db:migrate
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **First-time setup**: Visit `http://localhost:3000` — the first user creates the library and gets an invite token to share with friends.

## Deployment (Vercel)

1. Back up the database and test migrations on a current Turso production clone.
2. For an existing deployment, adopt the baseline and apply later migrations by following `docs/migrations.md` before deploying this code.
3. Set environment variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `JWT_SECRET`. `APP_ORIGIN` is an optional override for the canonical production domain.
4. Generate `JWT_SECRET` with a cryptographically secure command such as `openssl rand -base64 48`; do not use the value from `.env.example`.
5. Push to GitHub, import in Vercel, and deploy only after the migration checks pass.

## Tech Stack

- **Next.js** (App Router)
- **Tailwind CSS** + custom cozy theme
- **Drizzle ORM** + **Turso** (SQLite)
- **Framer Motion** (animations)
- **Google Books API** (book search)

## Quality Checks

```bash
npm run check      # lint, typecheck, and unit tests
npm run test:e2e   # isolated local database and browser workflow
npm run build      # production build
```

Database changes are tracked under `drizzle/`. Existing deployments must adopt the baseline before running migrations; see `docs/migrations.md`.
