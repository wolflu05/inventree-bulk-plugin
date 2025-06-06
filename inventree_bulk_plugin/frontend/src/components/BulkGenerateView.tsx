import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { ActionIcon, Flex, Group, Loader, Stack, Table, Tooltip } from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { IconClipboard, IconEdit, IconEye, IconFile, IconPlus, IconTrash } from "@tabler/icons-preact";

import { PreviewCreate } from "./PreviewCreate";
import { TemplateForm } from "./TemplateForm";
import { Dialog } from "./ui/Dialog";
import { useApi } from "../contexts/InvenTreeContext";
import { AxiosError, URLS } from "../utils/api";
import { TemplateModel } from "../utils/types";

interface BulkGenerateViewProps {
  templateType?: string;
  parentId?: string;
}

type BulkGenerateViewMode = "OVERVIEW" | "EDITING" | "DELETING" | "PREVIEWING" | "IMPORT_TEMPLATE";

export const BulkGenerateView = ({ templateType, parentId }: BulkGenerateViewProps) => {
  const [savedTemplates, setSavedTemplates] = useState<TemplateModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [currentTemplate, setCurrentTemplate] = useState<TemplateModel | null>(null);
  const [currentMode, setCurrentMode] = useState<BulkGenerateViewMode>("OVERVIEW");

  const api = useApi();

  const reloadSavedTemplates = useCallback(() => {
    setIsLoading(true);
    api
      .get(URLS.templates({ templateType }))
      .then((res) => {
        setSavedTemplates(
          res.data.map((t: Record<string, unknown>) => ({
            ...t,
            template: JSON.parse(t.template as string),
          })) as TemplateModel[],
        );
        setIsLoading(false);
      })
      .catch((err) => {
        setIsLoading(false);
        showNotification({
          message: `Fetching templates failed,\n${err.statusText}`,
          color: "red",
        });
        return;
      });
  }, [templateType, api]);

  useEffect(() => {
    reloadSavedTemplates();
  }, [reloadSavedTemplates]);

  const switchModeWithTemplate = useCallback(
    (mode: BulkGenerateViewMode, template: TemplateModel | null) => () => {
      setCurrentMode(mode);
      setCurrentTemplate(template);
    },
    [],
  );

  const handleBack = useCallback(() => {
    setCurrentTemplate(null);
    setCurrentMode("OVERVIEW");
    reloadSavedTemplates();
  }, [reloadSavedTemplates]);

  const handleDelete = useCallback(async () => {
    if (currentTemplate === null) return;

    try {
      await api.delete(URLS.templates({ id: currentTemplate.id }));
    } catch (err) {
      showNotification({
        color: "red",
        message: `Deleting template failed,\n${(err as AxiosError).response?.statusText}`,
      });
      return;
    }

    setCurrentTemplate(null);
    setCurrentMode("OVERVIEW");
    setSavedTemplates((s) => [...s.filter((t) => t.id !== currentTemplate.id)]);

    showNotification({ color: "green", message: "Template successfully deleted." });
  }, [api, currentTemplate]);

  const previewHandler = useRef(() => {
    //
  });
  const createHandler = useRef(() => {
    //
  });

  const handleClosePreviewDialog = useCallback(() => {
    setHasPreviewed(false);
    setCurrentTemplate(null);
    setCurrentMode("OVERVIEW");
  }, []);

  const [isBulkCreateLoading, setIsBulkCreateLoading] = useState(false);
  const [hasPreviewed, setHasPreviewed] = useState(false);

  const importTemplate = useCallback(
    (t: string) => {
      const data = JSON.parse(t);
      if (!("template_type" in data) || !("name" in data) || !("template" in data)) {
        throw new Error("invalid format");
      }

      if (templateType && templateType !== data.template_type) {
        throw new Error(`Template type ${data.template_type} cannot be imported as a ${templateType} template.`);
      }
      switchModeWithTemplate("EDITING", { id: null, ...data })();
    },
    [switchModeWithTemplate, templateType],
  );

  const fileInputRef = useRef(null);
  const [fileUploaded, setFileUploaded] = useState(false);

  const handleFileImport = useCallback(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const file = (fileInputRef as any).current?.files?.[0];
      const fr = new FileReader();
      fr.onload = (ee) => {
        try {
          importTemplate(ee.target?.result?.toString() || "");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((fileInputRef as any).current?.value) (fileInputRef as any).current.value = "";
        } catch (err) {
          showNotification({ color: "red", message: `Cannot import from file. ${err}` });
        }
      };
      fr.readAsText(file, "UTF-8");
    } catch (err) {
      showNotification({ color: "red", message: `Cannot import from file. ${err}` });
    }
  }, [importTemplate]);

  if (currentMode === "EDITING") {
    return (
      <div>
        <TemplateForm
          handleBack={handleBack}
          templateId={currentTemplate?.id}
          templateType={templateType}
          parentId={parentId}
          initialTemplate={currentTemplate?.id === null ? currentTemplate : undefined}
        />
      </div>
    );
  }

  return (
    <Stack>
      <Group gap="xs" justify="flex-end">
        <Tooltip label="Import schema from clipboard">
          <ActionIcon
            variant="outline"
            onClick={() =>
              navigator.clipboard
                .readText()
                .then((t) => importTemplate(t))
                .catch((err) => {
                  showNotification({ color: "red", message: `Error importing from clipboard, ${err}` });
                })
            }
          >
            <IconClipboard size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Import schema from file">
          <ActionIcon variant="outline" onClick={() => switchModeWithTemplate("IMPORT_TEMPLATE", null)()}>
            <IconFile size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Create new untitled schema">
          <ActionIcon variant="outline" onClick={switchModeWithTemplate("EDITING", null)}>
            <IconPlus size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={2}>
                <Flex justify={"center"}>
                  <Loader />
                </Flex>
              </Table.Td>
            </Table.Tr>
          ) : (
            savedTemplates.map((template) => (
              <Table.Tr>
                <Table.Td w="100%">{template.name}</Table.Td>
                <Table.Td style={{ display: "flex", gap: 8 }}>
                  <Tooltip label="Delete">
                    <ActionIcon color="red" onClick={switchModeWithTemplate("DELETING", template)} variant="outline">
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Edit">
                    <ActionIcon color="green" onClick={switchModeWithTemplate("EDITING", template)} variant="outline">
                      <IconEdit size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Preview/Bulk create">
                    <ActionIcon onClick={switchModeWithTemplate("PREVIEWING", template)} variant="outline">
                      <IconEye size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      <Dialog
        title="Delete template"
        show={currentMode === "DELETING"}
        onClose={() => {
          setCurrentTemplate(null);
          setCurrentMode("OVERVIEW");
        }}
        actions={[{ label: "Delete", variant: "filled", color: "red", onClick: handleDelete }]}
      >
        Are you sure you want to delete the template "{currentTemplate?.name}"?
      </Dialog>

      <Dialog
        title="Preview/bulk create from template"
        size="xl"
        show={currentMode === "PREVIEWING"}
        onClose={handleClosePreviewDialog}
        actions={[
          {
            label: "Preview",
            onClick: () => {
              previewHandler.current();
              setHasPreviewed(true);
            },
          },
          {
            label: "Bulk create",
            variant: "outline",
            onClick: () => createHandler.current(),
            disabled: isBulkCreateLoading || !hasPreviewed,
            loading: isBulkCreateLoading,
          },
        ]}
      >
        {currentTemplate && (
          <>
            <PreviewCreate
              template={currentTemplate}
              parentId={parentId}
              attachPreviewHandler={(handler) => {
                previewHandler.current = handler;
              }}
              attachCreateHandler={(handler) => {
                createHandler.current = handler;
              }}
              handleDoneCreate={(ok) => {
                if (ok) {
                  handleClosePreviewDialog();
                }
              }}
              setIsBulkCreateLoading={setIsBulkCreateLoading}
            />
            {!hasPreviewed && <i>You need to preview the generated items first.</i>}
          </>
        )}
      </Dialog>

      <Dialog
        title="Import template"
        show={currentMode === "IMPORT_TEMPLATE"}
        onClose={() => {
          setCurrentTemplate(null);
          setCurrentMode("OVERVIEW");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((fileInputRef as any).current?.value) (fileInputRef as any).current.value = "";
        }}
        actions={[{ label: "Import", variant: "outline", onClick: handleFileImport, disabled: !fileUploaded }]}
      >
        <input
          type="file"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onInput={(e) => setFileUploaded(!(e as any).current?.target?.files?.[0])}
          ref={fileInputRef}
        />
      </Dialog>
    </Stack>
  );
};
