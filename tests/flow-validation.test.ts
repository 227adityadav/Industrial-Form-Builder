import test from "node:test";
import assert from "node:assert/strict";
import { ensureTemplateAllowedInFolder, validateFolderSchedule } from "@/lib/flow-validation";
import type { FolderRecord } from "@/types/folder";

test("validateFolderSchedule rejects mixed hour/day schedule", () => {
  const err = validateFolderSchedule({
    nextFillDueHours: 4,
    nextFillDueDays: 1,
    nextFillDueTime: "10:00",
  });
  assert.equal(err, "nextFillDueHours cannot be combined with nextFillDueDays/nextFillDueTime");
});

test("validateFolderSchedule requires days and time together", () => {
  const err = validateFolderSchedule({
    nextFillDueDays: 1,
    nextFillDueTime: null,
  });
  assert.equal(err, "nextFillDueDays and nextFillDueTime must be set together");
});

test("ensureTemplateAllowedInFolder validates assignment", () => {
  const folder: FolderRecord = {
    id: "folder-1",
    name: "Main",
    templateIds: ["t-1"],
    allowedUsernames: ["op1"],
    masterFolderIds: [],
    nextFillDueHours: null,
    nextFillDueDays: null,
    nextFillDueTime: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.equal(ensureTemplateAllowedInFolder(folder, "t-1"), null);
  assert.equal(
    ensureTemplateAllowedInFolder(folder, "t-2"),
    "Template is not assigned to the selected folder"
  );
});
