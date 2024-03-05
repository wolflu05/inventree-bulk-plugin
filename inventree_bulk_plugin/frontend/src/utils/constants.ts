import { BulkDefinitionSchema } from "./types";

export const schemaVersion = "1.2.3";

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
