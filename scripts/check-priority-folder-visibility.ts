/**
 * Quick logic checks for urgency scoring + folder visibility (no DB).
 * Run: npx tsx scripts/check-priority-folder-visibility.ts
 */
import assert from "node:assert/strict";
import {
  buildFolderVisibility,
  canAccessFolder,
  type FolderAccessRow,
} from "../src/lib/folder-access";
import {
  PRIORITY_WEIGHT,
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

// --- Urgency ---
assert.equal(PRIORITY_WEIGHT.CRITICAL, 10);
assert.equal(PRIORITY_WEIGHT.MINIMAL, 1);
assert.equal(urgencyParts("MEDIUM", null).total, 4);
assert.equal(urgencyParts("MEDIUM", null).date, 0);
assert.ok(urgencyScore("CRITICAL", new Date(Date.now() - 86_400_000)) >= 15);
assert.equal(urgencyLevel(12), "critical");
assert.equal(urgencyLevel(9), "high");

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
