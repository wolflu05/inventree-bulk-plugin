import { useCallback, useEffect, useId, useMemo, useState } from "preact/hooks";

import { BulkDefinitionSchemaBuilder } from "./BulkDefinitionSchemaBuilder";
import { beautifySchema, getCounter, getUsedGenerateKeys, toFlat } from "../utils";
import { defaultSchema, getGenerateKeysForTemplateType } from "../utils/constants";
import { BulkDefinitionSchema, GenerateKeys, TemplateModel, TemplateType } from "../utils/types";

interface BulkGenerateViewProps {
  createURL: string;
  name: string;
  defaultSchema: null | BulkDefinitionSchema;
  templateType: TemplateType;
}

export function BulkGenerateView({
  createURL,
  name,
  defaultSchema: propsDefaultSchema = null,
  templateType,
}: BulkGenerateViewProps) {
  const [savedTemplates, setSavedTemplates] = useState<TemplateModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [schema, setSchema] = useState(() => propsDefaultSchema || structuredClone(defaultSchema));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [btnPreviewLoading, setBtnPreviewLoading] = useState(false);
  const [btnCreateLoading, setBtnCreateLoading] = useState(false);
  const [generateKeys, setGenerateKeys] = useState<GenerateKeys | null>(null);
  const id = useId();
  const tableId = useMemo(() => `preview-table-${id}`, [id]);

  // fetch generate keys on initial render
  useEffect(() => {
    getGenerateKeysForTemplateType(templateType).then((keys) => setGenerateKeys(keys));
  }, [templateType]);

  const reloadSavedTemplates = useCallback(async () => {
    const res = await fetch(`/plugin/inventree-bulk-plugin/templates?template_type=${templateType}`);
    const data = await res.json();

    setSavedTemplates(
      data.map((t: Record<string, unknown>) => ({
        ...t,
        template: JSON.parse(t.template as string),
      })) as TemplateModel[],
    );
    setIsLoading(false);
  }, [templateType]);

  useEffect(() => {
    reloadSavedTemplates();
  }, [reloadSavedTemplates]);

  const onPreview = useCallback(async () => {
    setError("");
    setSuccess("");
    setBtnPreviewLoading(true);

    const res = await fetch(`/plugin/inventree-bulk-plugin/parse?template_type=${templateType}`, {
      method: "POST",
      body: JSON.stringify(beautifySchema(schema)),
    });
    const json = await res.json();

    if (res.status !== 200) {
      setError(`An error occourd, ${json.error}`);
      setBtnPreviewLoading(false);
      return;
    }

    const data = toFlat(json, getCounter());

    setSuccess(`Successfully parsed. This will generate ${data.length} ${name}.`);

    const usedGenerateKeys = getUsedGenerateKeys(schema);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $table = $(`#${tableId}`) as any;
    $table.bootstrapTable("destroy");
    $table.bootstrapTable({
      data,
      idField: "id",
      columns: [
        ...Object.entries(generateKeys || {})
          .filter(([key]) => usedGenerateKeys.includes(key))
          .map(([key, { name }]) => ({ field: key, title: name })),
        { field: "path", title: "Path" },
      ],
      treeShowField: "name",
      parentIdField: "pid",
      onPostBody() {
        const columns = $table.bootstrapTable("getOptions").columns;

        if (columns && columns[0][1].visible) {
          $table.treegrid({
            treeColumn: 0,
            onChange() {
              $table.bootstrapTable("resetView");
            },
          });
        }
      },
      rowStyle: () => ({
        css: {
          padding: "2px 0.5rem",
        },
      }),
    });

    setBtnPreviewLoading(false);
  }, [templateType, schema, name, tableId, generateKeys]);

  const onCreate = useCallback(async () => {
    setError("");
    setSuccess("");
    setBtnCreateLoading(true);

    const res = await fetch(createURL, {
      method: "POST",
      body: JSON.stringify(beautifySchema(schema)),
    });

    if (res.status !== 201) {
      const json = await res.json();
      setError(`An error occourd, ${json.error}`);
    } else {
      setSuccess(`Successfully created ${name}.`);
    }

    setBtnCreateLoading(false);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: correct types for bootstrap modal are not available
    bootstrap.Modal.getInstance("#bulkCreateModal").hide();
  }, [createURL, name, schema]);

  const loadTemplate = useCallback(
    (template: TemplateModel) => () => {
      setSchema(template.template);
    },
    [],
  );

  return (
    <div>
      <div class="card mb-2">
        <div class="card-header">
          <h5
            class="mb-0 user-select-none"
            role="button"
            data-bs-toggle="collapse"
            data-bs-target="#accordion-saved-templates"
          >
            Saved templates
          </h5>
        </div>

        <div id="accordion-saved-templates" class="collapse show">
          <div class="card-body">
            <table class="table table-bordered" style="max-width: 500px">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={2}>
                      <div class="d-flex justify-content-center">
                        <div class="spinner-border" role="status">
                          <span class="visually-hidden">Loading...</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  savedTemplates.map((template) => (
                    <tr>
                      <td>{template.name}</td>
                      <td>
                        <button class="btn btn-sm btn-outline-success" onClick={loadTemplate(template)}>
                          Load
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {generateKeys !== null && (
        <BulkDefinitionSchemaBuilder schema={schema} setSchema={setSchema} generateKeys={generateKeys} />
      )}

      <div class="mt-3">
        {success && <div class="alert alert-success">{success}</div>}
        {error && <div class="alert alert-danger">{error}</div>}

        <button type="button" class="btn btn-primary" onClick={onPreview} disabled={btnPreviewLoading}>
          <span
            class="spinner-border spinner-border-sm me-1"
            style={`display: ${btnPreviewLoading ? "inline-block" : "none"};`}
            role="status"
            aria-hidden="true"
            id="loadingindicator-preview"
          ></span>
          Preview
        </button>
        <button
          type="button"
          class="btn btn-outline-primary ms-2"
          data-bs-toggle="modal"
          data-bs-target="#bulkCreateModal"
        >
          Create
        </button>
      </div>

      <div class="modal fade" id="bulkCreateModal" tabIndex={-1} aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h1 class="modal-title fs-5" id="exampleModalLabel">
                Bulk create ${name}
              </h1>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">Are you sure you want to bulk generate sub-{name} here?</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" disabled={btnCreateLoading}>
                Close
              </button>
              <button type="button" class="btn btn-primary" onClick={onCreate} disabled={btnCreateLoading}>
                <span
                  class="spinner-border spinner-border-sm me-1"
                  style={`display: ${btnCreateLoading ? "inline-block" : "none"};`}
                  role="status"
                  aria-hidden="true"
                  id="loadingindicator-create"
                ></span>
                Bulk generate
              </button>
            </div>
          </div>
        </div>
      </div>
      <table id={tableId} class="mt-3"></table>
    </div>
  );
}
