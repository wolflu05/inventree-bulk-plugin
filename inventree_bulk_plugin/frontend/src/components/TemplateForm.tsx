import { JSX } from "preact";
import { Dispatch, StateUpdater, useCallback, useEffect, useMemo, useState } from "preact/hooks";

import { ActionIcon, Button, Center, Group, Loader, Stack, Title } from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { IconClipboard, IconFileDownload } from "@tabler/icons-preact";

import { BulkDefinitionSchemaBuilder } from "./BulkDefinitionSchemaBuilder";
import { PreviewTable } from "./PreviewTable";
import { Dialog } from "./ui/Dialog";
import { Input } from "./ui/Input";
import { Tooltip } from "./ui/Tooltip";
import { useBulkGenerateInfo } from "../contexts/BulkCreateInfo";
import { useApi } from "../contexts/InvenTreeContext";
import { beautifySchema, downloadFile, isEqual } from "../utils";
import { AxiosError, URLS } from "../utils/api";
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
  const updateTemplate: Dispatch<StateUpdater<BulkDefinitionSchema>> = useCallback((v) => {
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
  const { bulkGenerateInfoDict } = useBulkGenerateInfo();
  const templateTypeOptions = useMemo(
    () => Object.fromEntries(Object.values(bulkGenerateInfoDict).map((v) => [v.template_type, v.name])),
    [bulkGenerateInfoDict],
  );

  const api = useApi();

  useEffect(() => {
    if (!template?.template_type || !parentId) return;

    setIsBulkGenerateInfoLoading(true);

    api
      .get(URLS.bulkcreate({ parentId, templateType: template.template_type }))
      .then((res) => {
        setBulkGenerateInfo(res.data);
        setIsBulkGenerateInfoLoading(false);
      })
      .catch((err) => {
        setIsBulkGenerateInfoLoading(false);
        showNotification({
          color: "red",
          message: `Failed to load bulk generate info,\n${(err as AxiosError).response?.statusText}`,
        });
      });
  }, [api, parentId, template?.template_type]);

  const isCreate = useMemo(() => !templateId && !template?.id, [template?.id, templateId]);

  const loadTemplate = useCallback(async () => {
    setIsLoading(true);
    let template: null | TemplateModel = null;

    if (initialTemplateModel) {
      template = structuredClone(initialTemplateModel);
    } else if (templateId) {
      let res;
      try {
        res = await api.get(URLS.templates({ id: templateId }));
      } catch (err) {
        setIsLoading(false);
        showNotification({
          color: "red",
          message: `Fetching template failed,\n${(err as AxiosError).response?.statusText}`,
        });
        return;
      }

      template = {
        ...res.data,
        template: JSON.parse(res.data.template as string),
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
  }, [api, initialTemplateModel, templateId, templateType]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const saveOrUpdate = useCallback(async () => {
    if (!template) return false;

    let res;
    try {
      res = await api(URLS.templates({ id: isCreate ? null : template.id }), {
        method: isCreate ? "POST" : "PUT",
        data: {
          ...template,
          template: JSON.stringify(beautifySchema(template.template)),
        },
      });
    } catch (err) {
      showNotification({
        color: "red",
        message: `An error occurred. ${Object.entries((err as AxiosError).response?.data as Record<string, string[]>)
          .map(([key, v]) => `${key}: ${v.join(", ")}`)
          .join(", ")}`,
        autoClose: false,
      });
      return false;
    }

    if (isCreate) {
      template.id = res.data.id;
      setTemplate({ ...template });
      showNotification({ color: "green", message: "Template successfully created." });
    } else {
      showNotification({ color: "green", message: "Template successfully updated." });
    }

    setInitialTemplate(structuredClone(template));
    return true;
  }, [api, isCreate, template]);

  const handleReset = useCallback(() => setTemplate(structuredClone(initialTemplate)), [initialTemplate]);

  const handlePreview = useCallback(() => {
    setPreviewTemplate(structuredClone(template));
  }, [template]);

  const [showBulkCreateDialog, setShowBulkCreateDialog] = useState(false);
  const [isBulkCreateLoading, setIsBulkCreateLoading] = useState(false);
  const handleBulkCreate = useCallback(async () => {
    if (template === null) return;

    setIsBulkCreateLoading(true);

    let res;
    try {
      res = await api.post(URLS.bulkcreate({ parentId, create: true }), {
        ...template,
        template: JSON.stringify(beautifySchema(template.template)),
      });
    } catch (err) {
      showNotification({ color: "red", message: `An error occurred, ${(err as AxiosError)?.response?.data}` });
      return;
    } finally {
      setIsBulkCreateLoading(false);
      setShowBulkCreateDialog(false);
    }

    showNotification({
      color: "green",
      message: `Successfully bulk created ${res.data.length} ${bulkGenerateInfoDict[template.template_type]?.name}s.`,
    });
  }, [api, bulkGenerateInfoDict, parentId, template]);

  const downloadAsFile = useCallback(() => {
    const filename = `${Date.now()}_${template?.name}.json`;
    downloadFile(
      filename,
      JSON.stringify({ name: template?.name, template_type: template?.template_type, template: template?.template }),
    );
    showNotification({
      color: "green",
      message: `Successfully downloaded template '${template?.name}' as '${filename}'.`,
    });
  }, [template?.name, template?.template, template?.template_type]);

  const saveToClipboard = useCallback(() => {
    navigator.clipboard
      .writeText(
        JSON.stringify({ name: template?.name, template_type: template?.template_type, template: template?.template }),
      )
      .then(() =>
        showNotification({
          color: "green",
          message: `Successfully copied template '${template?.name}' to clipboard.`,
        }),
      )
      .catch((err) =>
        showNotification({
          color: "red",
          message: `Error copying template '${template?.name}' to clipboard. ${err}`,
        }),
      );
  }, [template?.name, template?.template, template?.template_type]);

  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);

  return (
    <Stack>
      <Title order={4}>
        {isCreate ? "Create" : "Edit"} {!isCreate ? `"${template?.name}" ` : ""}template
      </Title>

      {isLoading && (
        <Center>
          <Loader />
        </Center>
      )}

      {!isLoading && !isBulkGenerateInfoLoading && bulkGenerateInfo && template && (
        <Stack>
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
        </Stack>
      )}

      <Group gap="xs">
        <Button
          size="xs"
          variant="outline"
          onClick={() => (hasChanged ? setShowSaveTemplateDialog(true) : handleBack())}
        >
          Back
        </Button>
        <Button
          size="xs"
          variant="outline"
          color={!hasChanged ? "gray" : "green"}
          onClick={saveOrUpdate}
          disabled={!hasChanged}
        >
          {isCreate ? "Create" : "Update"}
        </Button>
        {!isCreate && (
          <Button
            size="xs"
            variant="outline"
            color={!hasChanged ? "gray" : "red"}
            onClick={handleReset}
            disabled={!hasChanged}
          >
            Reset
          </Button>
        )}
        <Button size="xs" variant="outline" onClick={handlePreview}>
          Preview
        </Button>
        {parentId && (
          <Button size="xs" variant="outline" onClick={() => setShowBulkCreateDialog(true)}>
            Bulk create
          </Button>
        )}

        <ActionIcon.Group variant="outline">
          <Tooltip text="Copy to clipboard">
            <ActionIcon onClick={saveToClipboard} variant="outline">
              <IconClipboard size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip text="Download as file">
            <ActionIcon onClick={downloadAsFile} variant="outline">
              <IconFileDownload size={16} />
            </ActionIcon>
          </Tooltip>
        </ActionIcon.Group>
      </Group>

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
            onClick: handleBulkCreate,
            disabled: isBulkCreateLoading,
            loading: isBulkCreateLoading,
          },
        ]}
      >
        Are you sure you want to bulk generate{" "}
        {bulkGenerateInfoDict[template?.template_type || ""]?.name || template?.template_type}s here?
      </Dialog>

      <Dialog
        title="Save the template"
        show={showSaveTemplateDialog}
        onClose={() => setShowSaveTemplateDialog(false)}
        actions={[
          {
            label: "Don't save",
            variant: "outline",
            color: "red",
            onClick: handleBack,
          },
          {
            label: "Save",
            onClick: () => {
              saveOrUpdate().then((r) => {
                setShowSaveTemplateDialog(false);
                if (r === true) {
                  handleBack();
                }
              });
            },
          },
        ]}
      >
        Do you want to save the template?
      </Dialog>
    </Stack>
  );
};
