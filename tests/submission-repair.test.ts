import test from "node:test";
import assert from "node:assert/strict";
import type { FolderRecord } from "@/types/folder";
import type { FormSchema } from "@/types/form-schema";
import type { SubmissionRecord } from "@/types/submission";
import { repairSubmissionRecords } from "@/lib/db/submission-repair";

function mkTemplate(id: string, name: string): FormSchema {
  return {
    id,
    name,
    version: 1,
    sections: [
      { id: "s1", kind: "fields", title: "Info", fields: [] },
      { id: "s2", kind: "grid", title: "Grid", grid: { columns: [], rowCount: 1 } },
    ],
    footer: { fields: [] },
  };
}

function mkFolder(id: string, templateIds: string[]): FolderRecord {
  const now = new Date().toISOString();
  return {
    id,
    name: "Folder",
    templateIds,
    allowedUsernames: [],
    masterFolderIds: [],
    nextFillDueHours: null,
    nextFillDueDays: null,
    nextFillDueTime: null,
    createdAt: now,
    updatedAt: now,
  };
}

test("repairSubmissionRecords drops submissions with unknown templateId", () => {
  const submission: SubmissionRecord = {
    id: "s-1",
    templateId: "missing",
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    top: {},
    grid: null,
    footer: {},
  };
  const result = repairSubmissionRecords([submission], [mkTemplate("t-1", "T1")], []);
  assert.equal(result.records.length, 0);
  assert.equal(result.summary.dropped, 1);
});

test("repairSubmissionRecords clears invalid folder/template relationship", () => {
  const submission: SubmissionRecord = {
    id: "s-1",
    templateId: "t-1",
    folderId: "f-1",
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    top: {},
    grid: null,
    footer: {},
  };
  const result = repairSubmissionRecords(
    [submission],
    [mkTemplate("t-1", "T1")],
    [mkFolder("f-1", ["other-template"])]
  );
  assert.equal(result.records[0]?.folderId, undefined);
  assert.equal(result.summary.repaired, 1);
});

test("repairSubmissionRecords backfills templateSnapshot and default objects", () => {
  const submission = {
    id: "s-1",
    templateId: "t-1",
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    top: null,
    grid: null,
    footer: null,
  } as unknown as SubmissionRecord;
  const result = repairSubmissionRecords([submission], [mkTemplate("t-1", "T1")], []);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0]?.templateSnapshot?.id, "t-1");
  assert.deepEqual(result.records[0]?.top, {});
  assert.deepEqual(result.records[0]?.footer, {});
});
