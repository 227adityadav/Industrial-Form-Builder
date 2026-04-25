import type { GridColumnNode, Id, InputType } from "@/types/form-schema";

function clone<T>(v: T): T {
  return structuredClone(v);
}

export function newLeaf(label = "Column", inputType: InputType = "text"): GridColumnNode {
  return {
    id: crypto.randomUUID(),
    label,
    width: 140,
    leaf: { inputType },
  };
}

export function updateNode(
  cols: GridColumnNode[],
  id: Id,
  updater: (node: GridColumnNode) => GridColumnNode
): GridColumnNode[] {
  const next = clone(cols);

  const walk = (nodes: GridColumnNode[]): boolean => {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      if (n.id === id) {
        nodes[i] = updater(n);
        return true;
      }
      if (n.children?.length) {
        if (walk(n.children)) return true;
      }
    }
    return false;
  };

  walk(next);
  return next;
}

export function addChildColumn(cols: GridColumnNode[], parentId: Id): GridColumnNode[] {
  return updateNode(cols, parentId, (node) => {
    const children = node.children ? [...node.children] : [];
    children.push(newLeaf("Sub-column"));
    const { leaf, ...rest } = node;
    return { ...rest, children };
  });
}

/**
 * Crucial feature:
 * - If the header is a leaf: split into 2 leaf children below it.
 * - If it's already a parent: just add another child.
 */
export function splitIntoSubColumns(cols: GridColumnNode[], id: Id): GridColumnNode[] {
  return updateNode(cols, id, (node) => {
    if (node.children?.length) {
      return {
        ...node,
        children: [...node.children, newLeaf("Sub-column")],
      };
    }
    return {
      id: node.id,
      label: node.label,
      width: node.width,
      children: [newLeaf("Min"), newLeaf("Max")],
    };
  });
}

export function deleteNode(cols: GridColumnNode[], id: Id): GridColumnNode[] {
  const next = clone(cols);

  const walk = (nodes: GridColumnNode[]): GridColumnNode[] => {
    const kept: GridColumnNode[] = [];
    for (const n of nodes) {
      if (n.id === id) continue;
      if (n.children?.length) {
        kept.push({ ...n, children: walk(n.children) });
      } else {
        kept.push(n);
      }
    }
    return kept;
  };

  return walk(next);
}

