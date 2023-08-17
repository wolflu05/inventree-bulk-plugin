export interface GenerateKey {
  name: string;
  field_type: "text" | "boolean" | "number";
  required: boolean;
}

export type GenerateKeys = Record<string, GenerateKey>;

export interface BulkGenerateInfo {
  name: string;
  template_type: string;
  generate_type: string;
  fields: GenerateKeys;
}

export enum TemplateType {
  STOCK_LOCATION = "STOCK_LOCATION",
  PART_CATEGORY = "PART_CATEGORY",
}

export interface TemplateModel {
  id: number | null;
  name: string;
  template_type: TemplateType;
  template: BulkDefinitionSchema;
}

export interface BulkDefinitionSchema {
  version: string;
  input: Record<string, string>;
  templates: BulkDefinitionChildTemplate[];
  output: BulkDefinitionChild;
}

export interface BulkDefinitionChild {
  parent_name_match?: string;
  extends?: string;
  dimensions: (string | null)[];
  count: (string | null)[];
  generate: Record<string, string>;
  child?: BulkDefinitionChild;
  childs?: BulkDefinitionChild[];
}

export interface BulkDefinitionChildTemplate extends BulkDefinitionChild {
  name: string;
}

export type BulkGenerateAPIResult = Array<[Record<string, string | number | boolean>, BulkGenerateAPIResult]>;

export interface PageRenderProps {
  target: HTMLElement;
  ctxId: string;
}
