import { render as preact_render, JSX } from 'preact'
import { StateUpdater, useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { beautifySchema, getCounter, getUsedGenerateKeys, isEqual, toFlat } from "../utils";
import { defaultSchema, getGenerateKeysForTemplate, templateTypeOptions } from "../utils/constants";
import { BulkDefinitionSchemaBuilder } from "../components/BulkDefinitionSchemaBuilder";
import { Input } from "../components/Input";
import { BulkDefinitionSchema, GenerateKeys, PageRenderProps, TemplateModel, TemplateType } from "../utils/types";

interface EditFormProps {
    template: TemplateModel;
    setTemplate: StateUpdater<TemplateModel>;
    templateTypeOptions: Record<string, string>;
    handleBack: () => void
}

function EditForm({ template, setTemplate, templateTypeOptions = {}, handleBack }: EditFormProps) {
    const [initialTemplate, setInitialTemplate] = useState<TemplateModel>(() => structuredClone(template));

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [btnPreviewLoading, setBtnPreviewLoading] = useState(false);

    const updateField = useCallback((k: string) => (e: JSX.TargetedEvent<HTMLInputElement, Event>) => setTemplate(t => ({ ...t, [k]: e.currentTarget.value })), [setTemplate]);
    const updateTemplate: StateUpdater<BulkDefinitionSchema> = useCallback((valueOrFunc) => {
        setTemplate((t) => ({ ...t, template: typeof valueOrFunc === "function" ? valueOrFunc(t.template) : valueOrFunc }))
    }, [setTemplate]);
    const hasChanged = useMemo(() => !isEqual(template, initialTemplate), [template, initialTemplate]);
    const create = template.id === null;

    const [allGenerateKeys, setAllGenerateKeys] = useState<Record<string, GenerateKeys>>({});

    // fetch generate keys on initial render
    useEffect(() => {
        getGenerateKeysForTemplate().then((keys) => setAllGenerateKeys(keys));
    }, []);

    const generateKeys = useMemo(() => allGenerateKeys[template.template_type] || null, [allGenerateKeys, template.template_type])

    const saveOrUpdate = useCallback(() => {
        (async () => {
            setSuccess("");
            setError("");

            const create = template.id === null;
            const res = await fetch(`/plugin/inventree-bulk-plugin/templates/${create ? "" : template.id}`, {
                method: create ? "POST" : "PUT",
                body: JSON.stringify({ ...template, template: JSON.stringify(beautifySchema(template.template)) })
            });
            const data = await res.json();

            if (200 <= res.status && res.status < 300) {
                if (create) {
                    template.id = data.id;
                    setSuccess("Template successfully created.");
                } else {
                    setSuccess("Template successfully updated.");
                }

                setInitialTemplate(structuredClone(template));
            } else {
                setError(`An error occurred. ${Object.entries(data as Record<string, { message: string }[]>).map(([key, v]) => `${key}: ${v.map(({ message }) => message).join(", ")}`).join(", ")}`)
            }
        })()
    }, [template]);
    const handleReset = useCallback(() => setTemplate(initialTemplate), [initialTemplate, setTemplate]);

    const showPreview = useCallback(async () => {
        setError("");
        setSuccess("");
        setBtnPreviewLoading(true);

        const res = await fetch(`/plugin/inventree-bulk-plugin/parse?template_type=${template.template_type}`, {
            method: "POST",
            body: JSON.stringify(beautifySchema(template.template))
        });
        const json = await res.json();

        if (res.status !== 200) {
            setError(`An error occourd, ${json.error}`);
            setBtnPreviewLoading(false);
            return;
        }

        const data = toFlat(json, getCounter());

        setSuccess(`Successfully parsed. This will generate ${data.length} items.`);

        const usedGenerateKeys = getUsedGenerateKeys(template.template);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const $table = $("#bulk-create-manage-preview-table") as any;
        $table.bootstrapTable("destroy");
        $table.bootstrapTable({
            data,
            idField: 'id',
            columns: [
                ...Object.entries(generateKeys).filter(([key,]) => usedGenerateKeys.includes(key)).map(([key, { name }]) => ({ field: key, title: name })),
                { field: 'path', title: 'Path' }
            ],
            treeShowField: 'name',
            parentIdField: 'pid',
            onPostBody() {
                const columns = $table.bootstrapTable('getOptions').columns

                if (columns && columns[0][1].visible) {
                    $table.treegrid({
                        treeColumn: 0,
                        onChange() {
                            $table.bootstrapTable('resetView')
                        }
                    })
                }
            },
            rowStyle: () => ({
                css: {
                    padding: "2px 0.5rem"
                }
            })
        });

        setBtnPreviewLoading(false);
    }, [template, generateKeys]);

    return <div>
        <h5>{create ? "Create" : "Edit"} {!create ? `"${template.name}" ` : ""}template</h5>

        <Input label="Name" type="text" value={template.name} onInput={updateField("name")} />
        <Input label="Template type" type="select" value={template.template_type} options={templateTypeOptions} onInput={updateField("template_type")} />

        {generateKeys !== null && <BulkDefinitionSchemaBuilder schema={template.template} setSchema={updateTemplate} generateKeys={generateKeys} />}

        <div class="mt-3">
            {success && <div class="alert alert-success">{success}</div>}
            {error && <div class="alert alert-danger">{error}</div>}
        </div>

        <div class="d-flex" style="gap: 5px">
            <button class={`btn ${(hasChanged && !create) ? 'btn-outline-secondary' : 'btn-outline-primary'}`} onClick={handleBack} disabled={hasChanged && !create}>Back</button>
            <button class={`btn ${!hasChanged ? 'btn-outline-secondary' : 'btn-outline-success'}`} onClick={saveOrUpdate} disabled={!hasChanged}>{create ? "Create" : "Update"}</button>
            {!create && <button class={`btn ${!hasChanged ? 'btn-outline-secondary' : 'btn-outline-danger'}`} onClick={handleReset} disabled={!hasChanged}>Reset</button>}
            <button type="button" class="btn btn-primary" onClick={showPreview} disabled={btnPreviewLoading}>
                <span class="spinner-border spinner-border-sm me-1" style={`display: ${btnPreviewLoading ? 'inline-block' : 'none'};`} role="status" aria-hidden="true" id="loadingindicator-preview" ></span>
                Preview
            </button>
        </div>
        <table id="bulk-create-manage-preview-table" class="mt-3"></table>
    </div >
}

function App() {
    const [savedTemplates, setSavedTemplates] = useState<TemplateModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingTemplate, setEditingTemplate] = useState<TemplateModel | null>(null);
    const [deletingTemplate, setDeletingTemplate] = useState<TemplateModel | null>(null);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const reloadSavedTemplates = useCallback(async () => {
        const res = await fetch("/plugin/inventree-bulk-plugin/templates");
        const data = await res.json();

        setSavedTemplates(data.map((t: Record<string, unknown>) => ({
            ...t,
            template: JSON.parse(t.template as string),
        })) as TemplateModel[]);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        reloadSavedTemplates();
    }, [reloadSavedTemplates]);

    const startEditing = useCallback((template: TemplateModel) => () => {
        setEditingTemplate(template);
    }, []);

    const createNew = useCallback(() => {
        setEditingTemplate({
            id: null,
            name: "",
            template_type: TemplateType.STOCK_LOCATION,
            template: structuredClone(defaultSchema),
        });
    }, []);

    const backEditing = useCallback(() => {
        setEditingTemplate(null);
        document.getElementById("bulk-create-manage-preview-table")!.innerHTML = "";
        reloadSavedTemplates();
    }, [reloadSavedTemplates]);

    const startDeleting = useCallback((template: TemplateModel) => () => {
        setDeletingTemplate(template);
        const modalEl = document.getElementById('createTemplateModal')!;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: correct types for bootstrap modal are not available
        bootstrap.Modal.getOrCreateInstance("#createTemplateModal").show();
        modalEl.addEventListener("hidden.bs.modal", () => {
            setDeletingTemplate(null);
        })
    }, []);

    const deleteTemplate = useCallback(async () => {
        if (deletingTemplate === null) return;

        setError("");
        setSuccess("");

        const res = await fetch(`/plugin/inventree-bulk-plugin/templates/${deletingTemplate.id}`, {
            method: "DELETE"
        });

        if (200 <= res.status && res.status < 300) {
            setSuccess(`Successfully deleted "${deletingTemplate.name}".`);
            setSavedTemplates(s => [...s.filter(t => t.id !== deletingTemplate.id)]);
        } else {
            setError("An error occured.")
        }

        setDeletingTemplate(null);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: correct types for bootstrap modal are not available
        bootstrap.Modal.getInstance("#createTemplateModal").hide();
    }, [deletingTemplate]);

    if (isLoading) {
        return <div class="d-flex justify-content-center">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    }

    if (editingTemplate !== null) {
        return (
            <div>
                <EditForm template={editingTemplate} setTemplate={setEditingTemplate as unknown as StateUpdater<TemplateModel>} templateTypeOptions={templateTypeOptions} handleBack={backEditing} />
            </div>
        )
    }

    return (
        <div>
            <table class="table table-bordered" style="max-width: 500px">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Template type</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {(savedTemplates).map(template =>
                        <tr>
                            <td>{template.name}</td>
                            <td>{template.template_type}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-danger me-1" onClick={startDeleting(template)}>Delete</button>
                                <button class="btn btn-sm btn-outline-success" onClick={startEditing(template)}>Edit</button>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div class="mt-3">
                {success && <div class="alert alert-success">{success}</div>}
                {error && <div class="alert alert-danger">{error}</div>}
            </div>

            <div class="d-flex" style="gap: 5px">
                <button class='btn btn-primary' onClick={createNew}>New Template</button>
            </div>

            <div class="modal fade" id="createTemplateModal" tabIndex={-1} aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h1 class="modal-title fs-5" id="exampleModalLabel">Bulk create {name}</h1>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            Are you sure you want to delete "{deletingTemplate ? deletingTemplate.name : ""}"?
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onClick={deleteTemplate}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function render({ target }: PageRenderProps) {
    preact_render(<App />, target)
}
