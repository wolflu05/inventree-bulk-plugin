import { BulkDefinitionChild, BulkDefinitionSchema, BulkGenerateAPIResult } from "./types";

// types can be any for this function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isEqual = (x: any, y: any): boolean => {
  if (x === y) return true;

  if ((x === null && y !== null) || (x !== null && y === null)) {
    return false;
  }

  if (typeof x !== typeof y) return false;

  if (Array.isArray(x) && Array.isArray(y)) {
    if (x.length !== y.length) return false;

    return x.every((_, i) => isEqual(x[i], y[i]));
  }

  if (x instanceof Date && y instanceof Date) {
    return x.getTime() === y.getTime();
  }

  if (typeof x === "object") {
    const xKeys = Object.keys(x);
    const yKeys = Object.keys(y);
    if (xKeys.length !== yKeys.length) return false;
    return xKeys.every((k) => isEqual(x[k], y[k]));
  }

  return false;
};

export const beautifyChildSchema = <T extends BulkDefinitionChild>(childSchema: T): T => {
  const out = { ...childSchema };

  if (out.parent_name_match === "") delete out.parent_name_match;
  if (out.extends === "") delete out.extends;

  out.count = childSchema.count.map((c) => c || null);
  out.childs = childSchema.childs?.map(beautifyChildSchema);

  return out;
};

export const beautifySchema = (schema: BulkDefinitionSchema): BulkDefinitionSchema => {
  return {
    ...schema,
    templates: schema.templates.map(beautifyChildSchema),
    output: beautifyChildSchema(schema.output),
  };
};

export const getUsedGenerateKeys = (schema: BulkDefinitionSchema) => {
  const keys = new Set<string>();

  const collectKeys = (childSchema: BulkDefinitionChild) => {
    for (const k of Object.keys(childSchema.generate)) {
      keys.add(k);
    }
    childSchema.childs?.forEach((x) => collectKeys(x));
  };

  collectKeys(schema.output);
  schema.templates.forEach((x) => collectKeys(x));

  return [...keys];
};

export function getCounter(i = 1) {
  return () => i++;
}

type FlatedType = {
  id: number;
  pid: number;
  path: string;
  [key: string]: number | string | boolean;
};

export const toFlat = (data: BulkGenerateAPIResult, counter: () => number, pid = 0, pa = "...") =>
  data.flatMap(([parent, childs]): Array<FlatedType> => {
    const id = counter();
    const path = `${pa}/${parent.name}`;
    return [{ ...parent, id, pid, path }, ...toFlat(childs, counter, id, path)];
  });

export const escapeHtml = (unsafe: string) =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
