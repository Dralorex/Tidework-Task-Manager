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
- **Archive** — Admin+ soft-delete workspaces/folders with visibility (everyone / by role / specific people); history preserved
- **Folder templates** — starter trees (Simple / Project / Team) plus save/reuse workspace folder layouts
- **Calendar** — list/month views; drag personal, task, and workspace items between days
- **Social** — friends; DMs (friends free; workspace DMs need accept); Admin+ group chats

## Stack

Next.js (App Router) · Prisma · SQLite · bcrypt sessions · Tailwind CSS

## Setup

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npx prisma db push` | Sync schema to SQLite |
| `npx prisma studio` | Browse data |

## Roles

| Role | Content | Invite | Review |
|------|---------|--------|--------|
| Owner | Full | Yes | Yes |
| Admin | Full | Yes | Yes |
| Editor | Full | No | Yes |
| Member | Claim / complete | No | No |
