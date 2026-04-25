import type { InputType } from "@/types/form-schema";

/** True when a template default / prior value should be treated as “filled” (not blank). */
export function gridCellValueIsPresent(value: unknown, _inputType: InputType): boolean {
  if (value === undefined) return false;
  if (value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}
