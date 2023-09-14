import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { Dialog } from "./Dialog";
import { PreviewCreate } from "./PreviewCreate";
import { TemplateForm } from "./TemplateForm";
import { useNotifications } from "../contexts/Notification";
import { URLS, fetchAPI } from "../utils/api";
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

  const { showNotification } = useNotifications();

  const reloadSavedTemplates = useCallback(async () => {
    setIsLoading(true);

    const res = await fetchAPI(URLS.templates({ templateType }));

    if (!res.ok) {
      setIsLoading(false);
      return showNotification({ type: "danger", message: `Fetching templates failed,\n${res.statusText}` });
    }

    const data = await res.json();

    setSavedTemplates(
      data.map((t: Record<string, unknown>) => ({
        ...t,
        template: JSON.parse(t.template as string),
      })) as TemplateModel[],
    );
    setIsLoading(false);
  }, [showNotification, templateType]);

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

    const res = await fetchAPI(URLS.templates({ id: currentTemplate.id }), {
      method: "DELETE",
    });

    if (!res.ok) {
      return showNotification({ type: "danger", message: `Deleting template failed,\n${res.statusText}` });
    }

    setCurrentTemplate(null);
    setCurrentMode("OVERVIEW");
    setSavedTemplates((s) => [...s.filter((t) => t.id !== currentTemplate.id)]);

    showNotification({ type: "success", message: "Template successfully deleted." });
  }, [currentTemplate, showNotification]);

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
          showNotification({ type: "danger", message: `Cannot import from file. ${err}` });
        }
      };
      fr.readAsText(file, "UTF-8");
    } catch (err) {
      showNotification({ type: "danger", message: `Cannot import from file. ${err}` });
    }
  }, [importTemplate, showNotification]);

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
    <div>
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
                  <button
                    class="btn btn-sm btn-outline-danger me-1"
                    onClick={switchModeWithTemplate("DELETING", template)}
                  >
                    Delete
                  </button>
                  <button
                    class="btn btn-sm btn-outline-success me-1"
                    onClick={switchModeWithTemplate("EDITING", template)}
                  >
                    Edit
                  </button>
                  <button
                    class="btn btn-sm btn-outline-primary"
                    onClick={switchModeWithTemplate("PREVIEWING", template)}
                  >
                    Preview/Bulk create
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div class="btn-group">
        <button type="button" class="btn btn-outline-primary" onClick={switchModeWithTemplate("EDITING", null)}>
          New untitled schema
        </button>
        <button
          class="btn btn-outline-primary dropdown-toggle dropdown-toggle-split"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        ></button>
        <ul class="dropdown-menu">
          <li>
            <button
              class="dropdown-item"
              onClick={() =>
                navigator.clipboard
                  .readText()
                  .then((t) => importTemplate(t))
                  .catch((err) =>
                    showNotification({ type: "danger", message: `Error importing from clipboard, ${err}` }),
                  )
              }
            >
              From clipboard
            </button>
          </li>
          <li>
            <button class="dropdown-item" onClick={() => switchModeWithTemplate("IMPORT_TEMPLATE", null)()}>
              From file
            </button>
          </li>
        </ul>
      </div>

      <Dialog
        title="Delete template"
        show={currentMode === "DELETING"}
        onClose={() => {
          setCurrentTemplate(null);
          setCurrentMode("OVERVIEW");
        }}
        actions={[{ label: "Delete", type: "danger", onClick: handleDelete }]}
      >
        Are you sure you want to delete the template "{currentTemplate?.name}"?
      </Dialog>

      <Dialog
        title="Preview/bulk create from template"
        show={currentMode === "PREVIEWING"}
        onClose={handleClosePreviewDialog}
        actions={[
          {
            label: "Preview",
            type: "primary",
            onClick: () => {
              previewHandler.current();
              setHasPreviewed(true);
            },
          },
          {
            label: "Bulk create",
            type: "outline-primary",
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
            {!hasPreviewed && <i>You need to preview the items first.</i>}
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
        actions={[{ label: "Import", type: "outline-primary", onClick: handleFileImport, disabled: !fileUploaded }]}
      >
        <input
          type="file"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onInput={(e) => setFileUploaded(!(e as any).current?.target?.files?.[0])}
          ref={fileInputRef}
        />
      </Dialog>
    </div>
  );
};
