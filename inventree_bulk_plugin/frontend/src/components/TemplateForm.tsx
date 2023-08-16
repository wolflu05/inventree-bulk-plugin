import { JSX } from "preact";
import { StateUpdater, useCallback, useEffect, useMemo, useState } from "preact/hooks";

import { BulkDefinitionSchemaBuilder } from "./BulkDefinitionSchemaBuilder";
import { Dialog } from "./Dialog";
import { Input } from "./Input";
import { PreviewTable } from "./PreviewTable";
import { useGenerateKeys } from "../contexts/GenerateKeys";
import { useNotifications } from "../contexts/Notification";
import { beautifySchema, isEqual } from "../utils";
import { URLS, fetchAPI } from "../utils/api";
import { defaultSchema, templateTypeOptions } from "../utils/constants";
import { BulkDefinitionSchema, TemplateModel, TemplateType } from "../utils/types";

interface TemplateFormProps {
  templateId?: null | number;
  templateType?: TemplateType;
  handleBack: () => void;
  parentId?: string;
}

export const TemplateForm = ({ templateId, handleBack, templateType, parentId }: TemplateFormProps) => {
  const [initialTemplate, setInitialTemplate] = useState<TemplateModel | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateModel | null>(null);
  const [template, setTemplate] = useState<TemplateModel | null>(null);
  const hasChanged = useMemo(() => !isEqual(template, initialTemplate), [template, initialTemplate]);

  const updateField = useCallback(
    (k: string) => (e: JSX.TargetedEvent<HTMLInputElement, Event>) =>
      setTemplate((t) => (t ? { ...t, [k]: e.currentTarget.value } : null)),
    [],
  );
  const updateTemplate: StateUpdater<BulkDefinitionSchema> = useCallback((v) => {
    setTemplate((t) => {
      if (t === null) return t;
      return {
        ...t,
        template: typeof v === "function" ? v(t.template) : v,
      };
    });
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const { showNotification } = useNotifications();
  const { generateKeys } = useGenerateKeys();

  const isCreate = useMemo(() => !templateId && !template?.id, [template?.id, templateId]);

  const loadTemplate = useCallback(async () => {
    setIsLoading(true);
    let template: null | TemplateModel = null;

    if (templateId) {
      const res = await fetchAPI(URLS.templates({ id: templateId }));
      if (!res.ok) {
        setIsLoading(false);
        return showNotification({ type: "danger", message: `Fetching template failed,\n${res.statusText}` });
      }

      const data = await res.json();

      template = {
        ...data,
        template: JSON.parse(data.template as string),
      } as TemplateModel;
    } else {
      template = {
        id: null,
        name: "",
        template: structuredClone(defaultSchema),
        template_type: templateType || TemplateType.STOCK_LOCATION,
      };
    }

    setInitialTemplate(structuredClone(template));
    setTemplate(structuredClone(template));
    setIsLoading(false);
  }, [showNotification, templateId, templateType]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const saveOrUpdate = useCallback(async () => {
    if (!template) return;

    const res = await fetchAPI(URLS.templates({ id: isCreate ? null : template.id }), {
      method: isCreate ? "POST" : "PUT",
      body: JSON.stringify({ ...template, template: JSON.stringify(beautifySchema(template.template)) }),
    });
    const data = await res.json();

    if (!res.ok) {
      return showNotification({
        type: "danger",
        message: `An error occurred. ${Object.entries(data as Record<string, string[]>)
          .map(([key, v]) => `${key}: ${v.join(", ")}`)
          .join(", ")}`,
        autoHide: false,
      });
    }

    if (isCreate) {
      template.id = data.id;
      setTemplate({ ...template });
      showNotification({ type: "success", message: "Template successfully created." });
    } else {
      showNotification({ type: "success", message: "Template successfully updated." });
    }

    setInitialTemplate(structuredClone(template));
  }, [isCreate, showNotification, template]);

  const handleReset = useCallback(() => setTemplate(structuredClone(initialTemplate)), [initialTemplate]);

  const handlePreview = useCallback(() => {
    setPreviewTemplate(structuredClone(template));
  }, [template]);

  const [showBulkCreateDialog, setShowBulkCreateDialog] = useState(false);
  const [isBulkCreateLoading, setIsBulkCreateLoading] = useState(false);
  const handleBulkCreate = useCallback(async () => {
    if (template === null) return;

    setIsBulkCreateLoading(true);

    const res = await fetchAPI(URLS.bulkcreate({ parentId, create: true }), {
      method: "POST",
      body: JSON.stringify({
        ...template,
        template: JSON.stringify(beautifySchema(template.template)),
      }),
    });

    setIsBulkCreateLoading(false);
    setShowBulkCreateDialog(false);

    if (!res.ok) {
      const json = await res.json();
      return showNotification({ type: "danger", message: `An error occurred, ${json.error}` });
    }

    showNotification({ type: "success", message: `Successfully bulk created ${template.template_type}s.` });
  }, [parentId, showNotification, template]);

  return (
    <div>
      <h5>
        {isCreate ? "Create" : "Edit"} {!isCreate ? `"${template?.name}" ` : ""}template
      </h5>

      {isLoading && (
        <div class="d-flex justify-content-center">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {!isLoading && template && (
        <div>
          <Input label="Name" type="text" value={template.name} onInput={updateField("name")} />
          {!templateType && (
            <Input
              label="Template type"
              type="select"
              value={template.template_type}
              options={templateTypeOptions}
              onInput={updateField("template_type")}
            />
          )}

          <BulkDefinitionSchemaBuilder
            schema={template.template}
            setSchema={updateTemplate}
            generateKeys={generateKeys[template.template_type]}
          />
        </div>
      )}

      <div class="d-flex mt-2" style="gap: 5px">
        <button
          class={`btn ${hasChanged && !isCreate ? "btn-outline-secondary" : "btn-outline-primary"}`}
          onClick={handleBack}
          disabled={hasChanged && !isCreate}
        >
          Back
        </button>
        <button
          class={`btn ${!hasChanged ? "btn-outline-secondary" : "btn-outline-success"}`}
          onClick={saveOrUpdate}
          disabled={!hasChanged}
        >
          {isCreate ? "Create" : "Update"}
        </button>
        {!isCreate && (
          <button
            class={`btn ${!hasChanged ? "btn-outline-secondary" : "btn-outline-danger"}`}
            onClick={handleReset}
            disabled={!hasChanged}
          >
            Reset
          </button>
        )}
        <button class="btn btn-outline-primary" onClick={handlePreview}>
          Preview
        </button>
        {parentId && (
          <button class="btn btn-outline-primary" onClick={() => setShowBulkCreateDialog(true)}>
            Bulk create
          </button>
        )}
      </div>

      {previewTemplate && <PreviewTable template={previewTemplate} parentId={parentId} />}

      <Dialog
        title="Bulk create"
        show={showBulkCreateDialog}
        onClose={() => {
          setShowBulkCreateDialog(false);
        }}
        actions={[
          {
            label: "Bulk create",
            type: "primary",
            onClick: handleBulkCreate,
            disabled: isBulkCreateLoading,
            loading: isBulkCreateLoading,
          },
        ]}
      >
        Are you sure you want to bulk generate sub-{template?.template_type}s here?
      </Dialog>
    </div>
  );
};
