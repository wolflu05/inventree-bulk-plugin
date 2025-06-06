import type { AxiosError as AxiosError_ } from "axios";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AxiosError = AxiosError_<any, any>;

export const URLS = {
  bulkcreate: ({
    parentId,
    create,
    templateType,
  }: { parentId?: string; create?: boolean; templateType?: string } = {}) => {
    const params = new URLSearchParams();
    if (parentId) params.set("parent_id", parentId);
    if (create) params.set("create", create ? "true" : "false");
    if (templateType) params.set("template_type", templateType);
    const paramsString = params.toString();

    return `/plugin/inventree-bulk-plugin/bulkcreate${paramsString ? `?${paramsString}` : ""}`;
  },
  templates: ({ id, templateType }: { id?: number | null; templateType?: string } = {}) => {
    const params = new URLSearchParams();
    if (templateType) params.set("template_type", templateType);
    const paramsString = params.toString();

    return (
      `/plugin/inventree-bulk-plugin/templates${id !== undefined && id !== null ? `/${id}` : ""}` +
      `${paramsString ? `?${paramsString}` : ""}`
    );
  },
};
