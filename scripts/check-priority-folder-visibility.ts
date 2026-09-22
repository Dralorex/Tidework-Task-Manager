/**
 * Quick logic checks for urgency scoring + folder visibility (no DB).
 * Run: DATABASE_URL=postgresql://u:p@localhost:5432/db npx tsx scripts/check-priority-folder-visibility.ts
 */
import assert from "node:assert/strict";
import {
  buildFolderVisibility,
  canAccessFolder,
  type FolderAccessRow,
} from "../src/lib/folder-access";
import {
  PRIORITY_WEIGHT,
  dateBand,
  duePressure,
  urgencyLevel,
  urgencyParts,
  urgencyScore,
} from "../src/lib/urgency";

function folder(partial: Partial<FolderAccessRow> & Pick<FolderAccessRow, "id" | "name">): FolderAccessRow {
  return {
    parentId: null,
    requiredRoleIds: [],
    hideFromUnauthorized: false,
    alwaysVisible: false,
    roleHidesFolder: false,
    ...partial,
  };
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

// --- Urgency /100 ---
assert.equal(PRIORITY_WEIGHT.CRITICAL, 80);
assert.equal(PRIORITY_WEIGHT.MINIMAL, 10);
assert.equal(urgencyParts("MEDIUM", null).total, 40);
assert.equal(urgencyParts("MEDIUM", null).date, 0);
assert.equal(urgencyParts("MEDIUM", null).base, 40);

// Cubic date curve: Minimal + ~2 days → Critical total
const twoDays = duePressure(daysFromNow(2));
assert.ok(twoDays >= 70, `expected Date(2d) >= 70, got ${twoDays}`);
const minimalSoon = urgencyParts("MINIMAL", daysFromNow(2));
assert.equal(urgencyLevel(minimalSoon.total), "critical");
assert.ok(minimalSoon.total >= 80, `expected Total >= 80, got ${minimalSoon.total}`);

assert.equal(dateBand(0), "none");
assert.equal(dateBand(twoDays), "due");
assert.equal(urgencyLevel(10), "calm");
assert.equal(urgencyLevel(40), "medium");
assert.equal(urgencyLevel(80), "critical");
assert.ok(urgencyScore("CRITICAL", daysFromNow(-1)) >= 80);

// Far out → little date pressure
assert.ok(duePressure(daysFromNow(28)) <= 1);

// --- Folder visibility ---
const roleA = "role-a";
const folders: FolderAccessRow[] = [
  folder({
    id: "secret",
    name: "Secret",
    requiredRoleIds: [roleA],
    hideFromUnauthorized: true,
  }),
  folder({
    id: "always",
    name: "Always",
    requiredRoleIds: [roleA],
    hideFromUnauthorized: true,
    alwaysVisible: true,
  }),
  folder({
    id: "role-hide",
    name: "RoleHide",
    requiredRoleIds: [roleA],
    roleHidesFolder: true,
  }),
  folder({ id: "open", name: "Open" }),
];

const none = new Set<string>();
const withRole = new Set([roleA]);

const asMember = buildFolderVisibility(folders, none, { membershipRole: "MEMBER" });
assert.deepEqual(
  asMember.map((f) => f.id).sort(),
  ["always", "open"],
  "member without role should only see open + alwaysVisible",
);
assert.equal(asMember.find((f) => f.id === "always")?.locked, true);

const asMatcher = buildFolderVisibility(folders, withRole, { membershipRole: "MEMBER" });
assert.equal(asMatcher.length, 4);
assert.ok(asMatcher.every((f) => f.canAccess));

const asAdmin = buildFolderVisibility(folders, none, { membershipRole: "ADMIN" });
assert.equal(asAdmin.length, 4);
assert.ok(asAdmin.every((f) => f.canAccess));

const byId = new Map(folders.map((f) => [f.id, f]));
assert.equal(
  canAccessFolder("secret", byId, none, { membershipRole: "OWNER" }),
  true,
);
assert.equal(canAccessFolder("secret", byId, none, { membershipRole: "MEMBER" }), false);

console.log("ok: priority + folder visibility checks passed");
