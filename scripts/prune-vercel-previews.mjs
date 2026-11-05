#!/usr/bin/env node
/**
 * Keep at most N Vercel Preview deployments (default 5), deleting the oldest
 * first so Hobby/team preview slots stay open (often capped near 8).
 *
 * Env:
 *   VERCEL_TOKEN          required
 *   VERCEL_PROJECT_ID     preferred (prj_…)
 *   VERCEL_PROJECT_NAME   fallback search (default: rowgon-task-manager)
 *   VERCEL_ORG_ID         optional team/org id (team_…)
 *   PREVIEW_KEEP          how many newest previews to keep (default: 5)
 *   DRY_RUN               if "1", only print what would be deleted
 */

const TOKEN = process.env.VERCEL_TOKEN?.trim();
const KEEP = Math.max(0, Number(process.env.PREVIEW_KEEP ?? 5) || 5);
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const ORG_ID = process.env.VERCEL_ORG_ID?.trim() || process.env.VERCEL_TEAM_ID?.trim();
const PROJECT_NAME =
  process.env.VERCEL_PROJECT_NAME?.trim() || "rowgon-task-manager";

if (!TOKEN) {
  console.error("Missing VERCEL_TOKEN.");
  process.exit(1);
}

function apiUrl(path, params = {}) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (ORG_ID) url.searchParams.set("teamId", ORG_ID);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }
  return url;
}

async function vercel(path, { method = "GET", params, body } = {}) {
  const res = await fetch(apiUrl(path, params), {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      data?.error?.message || data?.message || text || res.statusText;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

async function resolveProjectId() {
  const fromEnv = process.env.VERCEL_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;

  const data = await vercel("/v9/projects", {
    params: { search: PROJECT_NAME, limit: 20 },
  });
  const projects = data?.projects ?? [];
  const exact =
    projects.find((p) => p.name === PROJECT_NAME) ||
    projects.find((p) => p.name?.includes("rowgon")) ||
    projects[0];
  if (!exact?.id) {
    throw new Error(
      `Could not resolve VERCEL_PROJECT_ID (searched “${PROJECT_NAME}”). Set VERCEL_PROJECT_ID.`,
    );
  }
  console.log(`Resolved project ${exact.name} (${exact.id})`);
  return exact.id;
}

function isPreviewDeployment(d) {
  const target = (d.target || "").toLowerCase();
  if (target === "production") return false;
  // Preview deploys are usually target=null/"preview" or have a non-production env
  if (target === "preview" || target === "") return true;
  return false;
}

async function listPreviewDeployments(projectId) {
  const all = [];
  let until = undefined;
  for (let page = 0; page < 50; page++) {
    const data = await vercel("/v6/deployments", {
      params: {
        projectId,
        limit: 100,
        ...(until ? { until } : {}),
      },
    });
    const batch = data?.deployments ?? [];
    if (batch.length === 0) break;
    for (const d of batch) {
      if (isPreviewDeployment(d)) all.push(d);
    }
    const last = batch[batch.length - 1];
    if (!last?.created || batch.length < 100) break;
    // next page: older than the last item
    until = last.created - 1;
  }
  // Newest first
  all.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  return all;
}

async function main() {
  const projectId = await resolveProjectId();
  const previews = await listPreviewDeployments(projectId);
  console.log(`Found ${previews.length} preview deployment(s); keeping ${KEEP}.`);

  if (previews.length <= KEEP) {
    console.log("Nothing to delete.");
    return;
  }

  const toDelete = previews.slice(KEEP); // oldest at the end of newest-first list
  // Delete oldest first (reverse of newest-first tail)
  toDelete.sort((a, b) => (a.created ?? 0) - (b.created ?? 0));

  console.log(
    `${DRY_RUN ? "Would delete" : "Deleting"} ${toDelete.length} oldest preview(s):`,
  );

  let deleted = 0;
  let failed = 0;
  for (const d of toDelete) {
    const when = d.created ? new Date(d.created).toISOString() : "?";
    const label = `${d.uid || d.id}  ${when}  ${d.url || d.name || ""}  meta=${d.meta?.githubCommitRef || d.meta?.githubPrId || ""}`;
    if (DRY_RUN) {
      console.log(`  - ${label}`);
      deleted += 1;
      continue;
    }
    try {
      await vercel(`/v13/deployments/${d.uid || d.id}`, { method: "DELETE" });
      console.log(`  ✓ ${label}`);
      deleted += 1;
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${label}\n    ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(
    `Done. ${DRY_RUN ? "Would remove" : "Removed"} ${deleted}; failed ${failed}; remaining kept ${KEEP}.`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
