import { BulkDefinitionSchema } from "./types";

export const templateTypeOptions = {
  PART_CATEGORY: "Part Category",
  STOCK_LOCATION: "Stock Location",
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
