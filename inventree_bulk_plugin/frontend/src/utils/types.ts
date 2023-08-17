export interface GenerateKey {
  name: string;
  field_type: "text" | "boolean" | "number";
  required: boolean;
  description: null | string;
}

export type GenerateKeys = Record<string, GenerateKey>;

export interface BulkGenerateInfo {
  name: string;
  template_type: string;
  generate_type: "single" | "tree";
  fields: GenerateKeys;
}

export interface TemplateModel {
  id: number | null;
  name: string;
  template_type: string;
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
  objectId: string;
  objectType: string;
}
