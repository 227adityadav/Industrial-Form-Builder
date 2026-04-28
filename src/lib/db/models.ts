import { randomUUID } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import type { Role } from "@/lib/auth";

const roleEnum: Role[] = ["admin", "user", "manager", "dashboard", "spc"];

const userSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: roleEnum },
    digitalSignaturePng: { type: String, required: false },
    digitalSignaturePasswordHash: { type: String, required: false },
    digitalSignatureSignerName: { type: String, required: false },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { _id: false, versionKey: false }
);

const sessionSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    token: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    role: { type: String, required: true, enum: roleEnum },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: true, versionKey: false }
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Full form template document (matches prior JSON shape, including `id` and flexible fields). */
const formTemplateSchema = new Schema(
  {},
  { strict: false, versionKey: false, collection: "form_templates" }
);
formTemplateSchema.index({ id: 1 }, { unique: true });

const folderSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    templateIds: { type: [String], default: [] },
    allowedUsernames: { type: [String], default: [] },
    masterFolderIds: { type: [String], default: [] },
    nextFillDueHours: { type: Schema.Types.Mixed, default: null },
    nextFillDueDays: { type: Schema.Types.Mixed, default: null },
    nextFillDueTime: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { _id: false, versionKey: false, collection: "folders" }
);

const masterFolderSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { _id: false, versionKey: false, collection: "master_folders" }
);

const submissionSchema = new Schema(
  {},
  { strict: false, versionKey: false, collection: "submissions" }
);
submissionSchema.index({ id: 1 }, { unique: true });

const refillNotificationSchema = new Schema(
  {},
  { strict: false, versionKey: false, collection: "refill_notifications" }
);
refillNotificationSchema.index({ id: 1 }, { unique: true });

export const UserModel = mongoose.models.User || mongoose.model("User", userSchema, "users");
export const SessionModel = mongoose.models.Session || mongoose.model("Session", sessionSchema, "sessions");
export const FormTemplateModel =
  mongoose.models.FormTemplate || mongoose.model("FormTemplate", formTemplateSchema);
export const FolderModel = mongoose.models.Folder || mongoose.model("Folder", folderSchema);
export const MasterFolderModel = mongoose.models.MasterFolder || mongoose.model("MasterFolder", masterFolderSchema);
export const SubmissionModel = mongoose.models.Submission || mongoose.model("Submission", submissionSchema);
export const RefillNotificationModel =
  mongoose.models.RefillNotification || mongoose.model("RefillNotification", refillNotificationSchema);
