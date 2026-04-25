"use client";

import * as React from "react";
import type { GridColumnNode, InputType } from "@/types/form-schema";
import { deleteNode, splitIntoSubColumns, updateNode } from "@/lib/grid-ops";

function InputTypeSelect({
  value,
  onChange,
}: {
  value: InputType;
  onChange: (v: InputType) => void;
}) {
  return (
    <select
      className="ui-input-compact bg-white"
      value={value}
      onChange={(e) => onChange(e.target.value as InputType)}
    >
      <option value="text">Text</option>
      <option value="number">Number</option>
      <option value="select">Select</option>
      <option value="date">Date</option>
      <option value="toggle">Toggle</option>
    </select>
  );
}

function NodeEditor({
  node,
  depth,
  columns,
  setColumns,
}: {
  node: GridColumnNode;
  depth: number;
  columns: GridColumnNode[];
  setColumns: (next: GridColumnNode[]) => void;
}) {
  const isLeaf = !node.children?.length;
  const leafType = node.leaf?.inputType ?? "text";

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200/90 bg-zinc-50/40 px-3 py-2 ring-1 ring-zinc-950/[0.03]"
        style={{ marginLeft: depth * 16 }}
      >
        <input
          className="ui-input-compact min-w-48 flex-1"
          value={node.label}
          onChange={(e) =>
            setColumns(updateNode(columns, node.id, (n) => ({ ...n, label: e.target.value })))
          }
        />

        <input
          className="ui-input-compact w-24"
          type="number"
          value={node.width ?? 140}
          onChange={(e) =>
            setColumns(
              updateNode(columns, node.id, (n) => ({ ...n, width: Number(e.target.value) }))
            )
          }
          title="Width (px)"
        />

        {isLeaf ? (
          <>
            <InputTypeSelect
              value={leafType}
              onChange={(v) =>
                setColumns(
                  updateNode(columns, node.id, (n) => ({
                    ...n,
                    leaf: {
                      ...(n.leaf ?? {}),
                      inputType: v,
                      ...(v !== "number" ? { min: undefined, max: undefined } : {}),
                    },
                  }))
                )
              }
            />
            {leafType === "number" ? (
              <>
                <input
                  className="ui-input-compact w-[5.5rem]"
                  type="number"
                  placeholder="Min"
                  title="Inclusive minimum — operator cells outline green/red vs this range"
                  value={node.leaf?.min ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = Number(raw);
                    setColumns(
                      updateNode(columns, node.id, (nNode) => ({
                        ...nNode,
                        leaf: {
                          ...(nNode.leaf ?? { inputType: "number" }),
                          inputType: "number",
                          ...(raw === "" || !Number.isFinite(n) ? { min: undefined } : { min: n }),
                        },
                      }))
                    );
                  }}
                />
                <input
                  className="ui-input-compact w-[5.5rem]"
                  type="number"
                  placeholder="Max"
                  title="Inclusive maximum — operator cells outline green/red vs this range"
                  value={node.leaf?.max ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = Number(raw);
                    setColumns(
                      updateNode(columns, node.id, (nNode) => ({
                        ...nNode,
                        leaf: {
                          ...(nNode.leaf ?? { inputType: "number" }),
                          inputType: "number",
                          ...(raw === "" || !Number.isFinite(n) ? { max: undefined } : { max: n }),
                        },
                      }))
                    );
                  }}
                />
              </>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-zinc-500">Parent header</span>
        )}

        <button
          type="button"
          className="ui-btn-primary px-2.5 py-1.5 text-sm font-medium"
          onClick={() => setColumns(splitIntoSubColumns(columns, node.id))}
          title="Add Sub-column"
        >
          Add Sub-column
        </button>

        <button
          type="button"
          className="ui-btn-secondary px-2.5 py-1.5 text-sm"
          onClick={() => setColumns(deleteNode(columns, node.id))}
        >
          Delete
        </button>
      </div>

      {node.children?.length ? (
        <div className="flex flex-col gap-2">
          {node.children.map((child) => (
            <NodeEditor
              key={child.id}
              node={child}
              depth={depth + 1}
              columns={columns}
              setColumns={setColumns}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ColumnTreeEditor({
  columns,
  setColumns,
}: {
  columns: GridColumnNode[];
  setColumns: (next: GridColumnNode[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {columns.length === 0 ? (
        <div className="ui-placeholder py-8 text-sm">
          No columns yet. Add a root column to start.
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {columns.map((c) => (
          <NodeEditor
            key={c.id}
            node={c}
            depth={0}
            columns={columns}
            setColumns={setColumns}
          />
        ))}
      </div>
    </div>
  );
}

