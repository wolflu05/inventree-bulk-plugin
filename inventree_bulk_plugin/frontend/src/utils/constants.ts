import { BulkDefinitionSchema, GenerateKeys } from "./types";

export const templateTypeOptions = {
  PART_CATEGORY: "Part Category",
  STOCK_LOCATION: "Stock Location",
};

export const getGenerateKeysForTemplate = async () => {
  const res = await fetch("/plugin/inventree-bulk-plugin/parse", {
    method: "OPTIONS",
  });
  return (await res.json()) as Record<string, GenerateKeys>;
};

export const getGenerateKeysForTemplateType = async (type: string) => {
  const keys = await getGenerateKeysForTemplate();
  return keys[type];
};

export const schemaVersion = "1.0.0";

export const defaultSchema: BulkDefinitionSchema = {
  version: schemaVersion,
  input: {},
  templates: [],
  output: {
    parent_name_match: "true",
    dimensions: [""],
    count: [""],
    generate: {},
  },
};
