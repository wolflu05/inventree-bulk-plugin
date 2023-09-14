import { JSX } from "preact";
import { StateUpdater, useCallback, useEffect, useMemo, useState } from "preact/hooks";

import { BulkDefinitionSchemaBuilder } from "./BulkDefinitionSchemaBuilder";
import { Dialog } from "./Dialog";
import { Input } from "./Input";
import { PreviewTable } from "./PreviewTable";
import { Tooltip } from "./Tooltip";
import { useBulkGenerateInfo } from "../contexts/BulkCreateInfo";
import { useNotifications } from "../contexts/Notification";
import { beautifySchema, downloadFile, isEqual } from "../utils";
import { URLS, fetchAPI } from "../utils/api";
import { defaultSchema } from "../utils/constants";
import { BulkDefinitionSchema, BulkGenerateInfo, TemplateModel } from "../utils/types";

interface TemplateFormProps {
  templateId?: null | number;
  templateType?: string;
  handleBack: () => void;
  parentId?: string;
  initialTemplate?: TemplateModel;
}

export const TemplateForm = ({
  templateId,
  handleBack,
  templateType,
  parentId,
  initialTemplate: initialTemplateModel,
}: TemplateFormProps) => {
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
  const [isBulkGenerateInfoLoading, setIsBulkGenerateInfoLoading] = useState(true);
  const [bulkGenerateInfo, setBulkGenerateInfo] = useState<BulkGenerateInfo>();
  const { showNotification } = useNotifications();
  const { bulkGenerateInfoDict } = useBulkGenerateInfo();
  const templateTypeOptions = useMemo(
    () => Object.fromEntries(Object.values(bulkGenerateInfoDict).map((v) => [v.template_type, v.name])),
    [bulkGenerateInfoDict],
  );

  useEffect(() => {
    if (!template?.template_type || !parentId) return;

    setIsBulkGenerateInfoLoading(true);

    (async () => {
      const res = await fetchAPI(URLS.bulkcreate({ parentId, templateType: template.template_type }));
      if (!res.ok) {
        setIsBulkGenerateInfoLoading(false);
        return showNotification({ type: "danger", message: `Failed to load bulk generate info,\n${res.statusText}` });
      }

      const data = await res.json();
      setBulkGenerateInfo(data);
      setIsBulkGenerateInfoLoading(false);
    })();
  }, [parentId, showNotification, template?.template_type]);

  const isCreate = useMemo(() => !templateId && !template?.id, [template?.id, templateId]);

  const loadTemplate = useCallback(async () => {
    setIsLoading(true);
    let template: null | TemplateModel = null;

    if (initialTemplateModel) {
      template = structuredClone(initialTemplateModel);
    } else if (templateId) {
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
        template_type: templateType || "STOCK_LOCATION",
      };
    }

    setInitialTemplate(structuredClone(template));
    setTemplate(structuredClone(template));
    setIsLoading(false);
  }, [initialTemplateModel, showNotification, templateId, templateType]);

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
    const json = await res.json();

    setIsBulkCreateLoading(false);
    setShowBulkCreateDialog(false);

    if (!res.ok) {
      return showNotification({ type: "danger", message: `An error occurred, ${json.error}` });
    }

    showNotification({
      type: "success",
      message: `Successfully bulk created ${json.length} ${bulkGenerateInfoDict[template.template_type]?.name}s.`,
    });
  }, [bulkGenerateInfoDict, parentId, showNotification, template]);

  const downloadAsFile = useCallback(() => {
    const filename = `${Date.now()}_${template?.name}.json`;
    downloadFile(
      filename,
      JSON.stringify({ name: template?.name, template_type: template?.template_type, template: template?.template }),
    );
    showNotification({
      type: "success",
      message: `Successfully downloaded template '${template?.name}' as '${filename}'.`,
    });
  }, [showNotification, template?.name, template?.template, template?.template_type]);

  const saveToClipboard = useCallback(() => {
    navigator.clipboard
      .writeText(
        JSON.stringify({ name: template?.name, template_type: template?.template_type, template: template?.template }),
      )
      .then(() =>
        showNotification({
          type: "success",
          message: `Successfully copied template '${template?.name}' to clipboard.`,
        }),
      )
      .catch((err) =>
        showNotification({
          type: "danger",
          message: `Error copying template '${template?.name}' to clipboard. ${err}`,
        }),
      );
  }, [showNotification, template?.name, template?.template, template?.template_type]);

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

      {!isLoading && !isBulkGenerateInfoLoading && bulkGenerateInfo && template && (
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
            bulkGenerateInfo={bulkGenerateInfo}
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
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary px-3" onClick={saveToClipboard}>
            <Tooltip text="Copy to clipboard" placement="top">
              <i class="fas fa-clipboard"></i>
            </Tooltip>
          </button>
          <button class="btn btn-outline-primary px-3" onClick={downloadAsFile} alt="Download as file">
            <Tooltip text="Download as file" placement="top">
              <i class="fas fa-download"></i>
            </Tooltip>
          </button>
        </div>
      </div>

      {previewTemplate && bulkGenerateInfo && (
        <PreviewTable template={previewTemplate} parentId={parentId} bulkGenerateInfo={bulkGenerateInfo} />
      )}

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
        Are you sure you want to bulk generate{" "}
        {bulkGenerateInfoDict[template?.template_type || ""]?.name || template?.template_type}s here?
      </Dialog>
    </div>
  );
};
