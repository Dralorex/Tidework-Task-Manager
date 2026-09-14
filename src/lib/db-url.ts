/**
 * Resolve a Postgres URL from the env names Vercel / Neon commonly inject.
 * Empty strings are treated as unset (integrations sometimes create blank placeholders).
 */
function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

const POOLED_CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "NEON_DATABASE_URL",
] as const;

const DIRECT_CANDIDATES = [
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "NEON_DATABASE_URL",
] as const;

function readEnv(names: readonly string[]): string | undefined {
  return firstNonEmpty(...names.map((name) => process.env[name]));
}

/** Pooled URL for app runtime (Prisma Neon adapter). */
export function getDatabaseUrl(): string {
  const url = readEnv(POOLED_CANDIDATES);
  if (!url) {
    throw new Error(
      "No database URL found. In Vercel → Project → Settings → Environment Variables, set DATABASE_URL (Neon pooled) for Production and Preview. Neon/Vercel Postgres also works via POSTGRES_URL.",
    );
  }
  return url;
}

/**
 * Direct (unpooled) URL for Prisma CLI migrations.
 * Returns undefined when unset so `prisma generate` can still run without a DB.
 */
export function getMigrationDatabaseUrl(): string | undefined {
  return readEnv(DIRECT_CANDIDATES);
}

export function requireMigrationDatabaseUrl(): string {
  const url = getMigrationDatabaseUrl();
  if (!url) {
    throw new Error(
      "No migration database URL found. Set DATABASE_URL_UNPOOLED (Neon direct) or DATABASE_URL in Vercel env for Production/Preview.",
    );
  }
  return url;
}
