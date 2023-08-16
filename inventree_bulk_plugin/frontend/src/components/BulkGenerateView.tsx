import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { Dialog } from "./Dialog";
import { PreviewCreate } from "./PreviewCreate";
import { TemplateForm } from "./TemplateForm";
import { useNotifications } from "../contexts/Notification";
import { URLS, fetchAPI } from "../utils/api";
import { TemplateModel, TemplateType } from "../utils/types";

interface BulkGenerateViewProps {
  templateType?: TemplateType;
  parentId?: string;
}

type BulkGenerateViewMode = "OVERVIEW" | "EDITING" | "DELETING" | "PREVIEWING";

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

  if (currentMode === "EDITING") {
    return (
      <div>
        <TemplateForm
          handleBack={handleBack}
          templateId={currentTemplate?.id}
          templateType={templateType}
          parentId={parentId}
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

      <button type="button" class="btn btn-outline-primary" onClick={switchModeWithTemplate("EDITING", null)}>
        New untitled schema
      </button>

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
    </div>
  );
};
