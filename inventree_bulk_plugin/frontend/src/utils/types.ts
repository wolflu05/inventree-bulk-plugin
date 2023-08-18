export interface FieldDefinitionBase {
  name: string;
  description: null | string;
  required: boolean;
  model: null | { model: string; limit_choices_to: Record<string, string> };
}

export interface FieldDefinitionText extends FieldDefinitionBase {
  field_type: "text" | "boolean" | "number" | "model";
}

export interface FieldDefinitionObject extends FieldDefinitionBase {
  field_type: "object";
  fields: Record<string, FieldDefinition>;
}

export interface FieldDefinitionList extends FieldDefinitionBase {
  field_type: "list";
  items_type: FieldDefinition;
}

export type FieldDefinition = FieldDefinitionText | FieldDefinitionObject | FieldDefinitionList;

export interface BulkGenerateInfo {
  name: string;
  template_type: string;
  generate_type: "single" | "tree";
  fields: Record<string, FieldDefinition>;
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

export type FieldType = string | { [key: string]: FieldType } | FieldType[];

export interface BulkDefinitionChild {
  parent_name_match?: string;
  extends?: string;
  dimensions: (string | null)[];
  count: (string | null)[];
  generate: Record<string, FieldType>;
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
