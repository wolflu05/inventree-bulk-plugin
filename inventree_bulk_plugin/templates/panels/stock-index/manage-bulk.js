{% include "components/BulkDefinitionSchemaBuilder.js" %}

const isEqual = (x, y) => {
  if (x === y) return true;

  if ((x === null && y !== null) || (x !== null && y === null)) {
    return false;
  }

  if (typeof x !== typeof y) return false;

  if (Array.isArray(x) && Array.isArray(y)) {
    if (x.length !== y.length) return false;

    return x.every((_, i) => isEqual(x[i], y[i]));
  }

  if (x instanceof Date && y instanceof Date) {
    return x.getTime() === y.getTime();
  }

  if(typeof x === "object") {
    const xKeys = Object.keys(x);
    const yKeys = Object.keys(y);
    if(xKeys.length !== yKeys.length) return false;
    return xKeys.every(k => isEqual(x[k], y[k]));
  }

  return false;
};

function EditForm({ template, setTemplate, templateTypeOptions = {}, handleBack }) {
  const [initialTemplate, setInitialTemplate] = useState({});
  useEffect(() => { setInitialTemplate(structuredClone(template)) }, []);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [btnPreviewLoading, setBtnPreviewLoading] = useState(false);

  const updateField = useCallback((k) => (e) => setTemplate(t => ({...t, [k]: e.target.value})), []);
  const updateTemplate = useCallback((valueOrFunc) => {
    setTemplate((t => ({...t, template: typeof valueOrFunc === "function" ? valueOrFunc(t.template) : valueOrFunc})))
  }, []);
  const hasChanged = useMemo(() => !isEqual(template, initialTemplate), [template, initialTemplate]);
  const create = template.id === null;

  const [allGenerateKeys, setAllGenerateKeys] = useState({});

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
      const res = await fetch("{% url 'plugin:inventree-bulk-plugin:templates' %}" + `/${create ? "" : template.id }`, {
        method: create ? "POST" : "PUT",
        body: JSON.stringify({...template, template: JSON.stringify(beautifySchema(template.template))})
      });
      const data = await res.json();

      if(200 <= res.status && res.status < 300) {

        if(create) {
          template.id = data.id;
          setSuccess("Template successfully created.");
        } else {
          setSuccess("Template successfully updated.");
        }

        setInitialTemplate(structuredClone(template));
      } else {
        setError("An error occurred. " + Object.entries(data).map(([key, v]) => `${key}: ${v.map(({message}) => message).join(", ")}`).join(", "))
      }
    })()
  }, [template]);
  const handleReset = useCallback(() => setTemplate(initialTemplate), [initialTemplate]);

  const showPreview = useCallback(async () => {
    setError("");
    setSuccess("");
    setBtnPreviewLoading(true);

    const res = await fetch("{% url 'plugin:inventree-bulk-plugin:parse' %}" + `?template_type=${template.template_type}`, {
      method: "POST",
      body: JSON.stringify(beautifySchema(template.template))
    });
    const json = await res.json();
    
    if (res.status !== 200) {
      setError(`An error occourd, ${json.error}`);
      setBtnPreviewLoading(false);
      return;
    }
    
    const getCounter = (i = 1) => () => i++
    const toFlat = (data, counter, pid = 0, pa = "...") => data.flatMap(([parent, childs]) => {
      const id = counter();
      const path = `${pa}/${parent.name}`
      return [{ ...parent, id, pid, path }, ...toFlat(childs, counter, id, path)]
    });

    const data = toFlat(json, getCounter());

    setSuccess(`Successfully parsed. This will generate ${data.length} items.`);

    const usedGenerateKeys = getUsedGenerateKeys(template.template);

    const $table = $("#bulk-create-manage-preview-table");
    $table.bootstrapTable("destroy");
    $table.bootstrapTable({
      data: data,
      idField: 'id',
      columns: [
        ...Object.entries(generateKeys).filter(([key, _definition]) => usedGenerateKeys.includes(key)).map(([key, { name }]) => ({ field: key, title: name })),
        { field: 'path', title: 'Path' }
      ],
      treeShowField: 'name',
      parentIdField: 'pid',
      onPostBody: function () {
        var columns = $table.bootstrapTable('getOptions').columns

        if (columns && columns[0][1].visible) {
          $table.treegrid({
            treeColumn: 0,
            onChange: function () {
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

  return html`
    <div>
      <h5>${create ? "Create" : "Edit"} ${!create ? "\"" + template.name + "\" " : ""}template</h5>

      <${Input} label="Name" type="text" value=${template.name} onInput=${updateField("name")} />
      <${Input} label="Template type" type="select" value=${template.template_type} options=${templateTypeOptions} onInput=${updateField("template_type")} />

      ${generateKeys !== null && html`<${BulkDefinitionSchemaBuilder} schema=${template.template} setSchema=${updateTemplate} generateKeys=${generateKeys} />`}

      <div class="mt-3">
        ${success && html`<div class="alert alert-success">${success}</div>`}
        ${error && html`<div class="alert alert-danger">${error}</div>`}
      </div>

      <div class="d-flex" style="gap: 5px">
        <button class="btn ${(hasChanged && !create) ? 'btn-outline-secondary' : 'btn-outline-primary'}" onClick=${handleBack} disabled=${hasChanged && !create}>Back</button>
        <button class="btn ${!hasChanged ? 'btn-outline-secondary' : 'btn-outline-success'}" onClick=${saveOrUpdate} disabled=${!hasChanged}>${create ? "Create" : "Update"}</button>
        ${!create && html`<button class="btn ${!hasChanged ? 'btn-outline-secondary' : 'btn-outline-danger'}" onClick=${handleReset} disabled=${!hasChanged}>Reset</button>`}
        <button type="button" class="btn btn-primary" onClick=${showPreview} disabled=${btnPreviewLoading}>
          <span class="spinner-border spinner-border-sm loadingindicator me-1" style="${btnPreviewLoading ? 'display: inline-block;' : ''}" role="status" aria-hidden="true" id="loadingindicator-preview"></span>
          Preview
        </button>
      </div>
    </div>
  `;
}

function App() {
  const [savedTemplates, setSavedTemplates] = useState();
  const [isLoading, setIsLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reloadSavedTemplates = useCallback(async () => {
    const res = await fetch("{% url 'plugin:inventree-bulk-plugin:templates' %}");
    const data = await res.json();

    setSavedTemplates(data.map(t => ({
      ...t,
      template: JSON.parse(t.template),
    })));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    reloadSavedTemplates();
  }, []);

  const startEditing = useCallback((template) => () => {
    setEditingTemplate(template);
  }, []);

  const createNew = useCallback(() => {
    setEditingTemplate({
      id: null,
      name: "",
      template_type: "STOCK_LOCATION",
      template: null,
    });
  }, []);

  const backEditing = useCallback(() => {
    setEditingTemplate(null);
    document.getElementById("bulk-create-manage-preview-table").innerHTML = "";
    reloadSavedTemplates();
  }, []);

  const startDeleting = useCallback((template) => () => {
    setDeletingTemplate(template);
    const modalEl = document.getElementById('createTemplateModal');
    bootstrap.Modal.getOrCreateInstance("#createTemplateModal").show();
    modalEl.addEventListener("hidden.bs.modal", () => {
      setDeletingTemplate(null);
    })
  });

  const deleteTemplate = useCallback(async () => {
    setError("");
    setSuccess("");

    const res = await fetch("{% url 'plugin:inventree-bulk-plugin:templates' %}" + `/${deletingTemplate.id}`, {
      method: "DELETE"
    });

    if(200 <= res.status && res.status < 300) {
      setSuccess(`Successfully deleted "${deletingTemplate.name}".`);
      setSavedTemplates(s => [...s.filter(t => t.id !== deletingTemplate.id)]);
    } else {
      setError("An error occured.")
    }

    setDeletingTemplate(null);
    bootstrap.Modal.getInstance("#createTemplateModal").hide();
  }, [deletingTemplate]);

  if(isLoading) {
    return html`
      <div class="d-flex justify-content-center">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;
  }

  if(editingTemplate !== null) {
    return html`
      <${EditForm} template=${editingTemplate} setTemplate=${setEditingTemplate} templateTypeOptions=${templateTypeOptions} handleBack=${backEditing} />
    `;
  }

  return html`
    <div>
      <table class="table table-bordered" style="max-width: 500px">
        <thead>
          <th>Name</th>
          <th>Template type</th>
          <th>Actions</th>
        </thead>
        <tbody>
          ${savedTemplates.map(template => html`
            <tr>
              <td>${template.name}</td>
              <td>${template.template_type}</td>
              <td>
                <button class="btn btn-sm btn-outline-danger me-1" onClick=${startDeleting(template)}>Delete</button>
                <button class="btn btn-sm btn-outline-success" onClick=${startEditing(template)}>Edit</button>
              </td>
            </tr>
          `)}
        </tbody>
      </table>

      <div class="mt-3">
        ${success && html`<div class="alert alert-success">${success}</div>`}
        ${error && html`<div class="alert alert-danger">${error}</div>`}
      </div>

      <div class="d-flex" style="gap: 5px">
        <button class='btn btn-primary' onClick=${createNew}>New Template</button>
      </div>

      <div class="modal fade" id="createTemplateModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h1 class="modal-title fs-5" id="exampleModalLabel">Bulk create ${name}</h1>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              Are you sure you want to delete "${deletingTemplate ? deletingTemplate.name : ""}"?
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button type="button" class="btn btn-primary" onClick=${deleteTemplate}>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById("bulk-create-manage-preact-root"));
