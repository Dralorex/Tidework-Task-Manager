# Tidework Task Manager

Collaborative task management where urgency rises with due dates — nested folders, claimable tasks, roles, friends, and private chats.

## Features (v1)

- **Auth** — username + password; optional email for password reset
- **Workspaces** — many per user; roles: Owner, Admin, Editor, Member
- **Folders & tasks** — nested folders (name required); priority + due date urgency edge
- **Claim & calendar** — pick up tasks; due dates sync to your in-app calendar
- **Review flow** — members complete with a comment; Owner/Admin review
- **Tags** — public tags (Editor+); private tags after claiming a task
- **Search** — name relevance + tag filters in the current folder area
- **Invites** — Owner/Admin invite by username or email
- **Social** — friends; DMs (friends free; workspace DMs need accept); Admin+ group chats

## Stack

Next.js (App Router) · Prisma · Neon Postgres · bcrypt sessions · Tailwind CSS

## Local setup

1. Create a free [Neon](https://neon.tech) database.
2. Copy env and fill in both connection strings from the Neon console:

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo login after seeding: **`tide_demo` / `password123`**

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. Connect a database (pick one):
   - **Neon integration** in Vercel → Storage / Marketplace, **or**
   - Paste env vars from the [Neon console](https://console.neon.tech) under **Settings → Environment Variables**
4. Ensure these are set for **Production** and **Preview** (empty values count as missing):
   - `DATABASE_URL` — Neon **pooled** connection string  
     *(or `POSTGRES_URL` / `POSTGRES_PRISMA_URL` from Vercel Postgres)*
   - `DATABASE_URL_UNPOOLED` — Neon **direct** connection string  
     *(or `POSTGRES_URL_NON_POOLING`)*
5. Redeploy. The build runs `prisma migrate deploy`, seeds the demo user, then `next build`.

If the build says the connection URL is empty, the env vars were not applied to that environment — open the failed deployment → **Environment**, confirm `DATABASE_URL` is present, then **Redeploy**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build (no migrate) |
| `npm run vercel-build` | Migrate, seed, and build (used on Vercel) |
| `npm run db:seed` | Seed demo user + sample workspace |
| `npx prisma migrate deploy` | Apply migrations |
| `npx prisma studio` | Browse data |

## Roles

| Role | Content | Invite | Review |
|------|---------|--------|--------|
| Owner | Full | Yes | Yes |
| Admin | Full | Yes | Yes |
| Editor | Full | No | Yes |
| Member | Claim / complete | No | No |
