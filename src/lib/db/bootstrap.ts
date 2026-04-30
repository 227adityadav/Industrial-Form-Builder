import { SubmissionModel } from "@/lib/db/models";

async function repairSubmissionIdsAndIndex(): Promise<void> {
  const bad = await SubmissionModel.collection
    .find(
      {
        $or: [{ id: null }, { id: "" }, { id: { $exists: false } }],
      },
      { projection: { _id: 1 } }
    )
    .toArray();

  if (bad.length > 0) {
    await SubmissionModel.collection.bulkWrite(
      bad.map((d) => ({
        updateOne: {
          filter: { _id: d._id },
          update: { $set: { id: String(d._id) } },
        },
      }))
    );
  }

  const indexes = await SubmissionModel.collection.indexes();
  const idIdx = indexes.find((i) => i.name === "id_1") as
    | ({ partialFilterExpression?: unknown } & Record<string, unknown>)
    | undefined;
  const hasPartial = Boolean(idIdx?.partialFilterExpression);

  if (!hasPartial) {
    try {
      await SubmissionModel.collection.dropIndex("id_1");
    } catch {
      // ignore if index does not exist yet
    }
    await SubmissionModel.collection.createIndex(
      { id: 1 },
      {
        name: "id_1",
        unique: true,
        partialFilterExpression: { id: { $type: "string" } },
      }
    );
  }
}

export async function runDataBootstrap(): Promise<void> {
  await repairSubmissionIdsAndIndex();
}
