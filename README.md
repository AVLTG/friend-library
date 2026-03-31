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
   Fill in your Turso credentials and a JWT secret (min 32 chars).

3. **Push database schema**
   ```bash
   npm run db:push
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **First-time setup**: Visit `http://localhost:3000` — the first user creates the library and gets an invite token to share with friends.

## Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Set environment variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`
4. Deploy

## Tech Stack

- **Next.js** (App Router)
- **Tailwind CSS** + custom cozy theme
- **Drizzle ORM** + **Turso** (SQLite)
- **Framer Motion** (animations)
- **Google Books API** (book search)
