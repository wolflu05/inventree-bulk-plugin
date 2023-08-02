{% include "components/BulkDefinitionSchemaBuilder.js" %}

function generateBulkCreateView({ target, createURL, name, defaultSchema = null, tableSelector, templateType }) {
  function App() {
    const [savedTemplates, setSavedTemplates] = useState();
    const [isLoading, setIsLoading] = useState(true);
    const [schema, setSchema] = useState(defaultSchema);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [btnPreviewLoading, setBtnPreviewLoading] = useState(false);
    const [btnCreateLoading, setBtnCreateLoading] = useState(false);
    const [generateKeys, setGenerateKeys] = useState(null);

    // fetch generate keys on initial render
    useEffect(() => {
      getGenerateKeysForTemplateType(templateType).then((keys) => setGenerateKeys(keys));
    }, []);

    const reloadSavedTemplates = useCallback(async () => {
      const res = await fetch("{% url 'plugin:inventree-bulk-plugin:templates' %}" + `?template_type=${templateType}`);
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

    const onPreview = useCallback(async () => {
      setError("");
      setSuccess("");
      setBtnPreviewLoading(true);
      
      const res = await fetch("{% url 'plugin:inventree-bulk-plugin:parse' %}" + `?template_type=${templateType}`, {
        method: "POST",
        body: JSON.stringify(beautifySchema(schema))
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

      setSuccess(`Successfully parsed. This will generate ${data.length} ${name}.`);

      const usedGenerateKeys = getUsedGenerateKeys(schema);

      const $table = $(tableSelector);
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
    }, [schema, generateKeys]);

    const onCreate = useCallback(async () => {
      setError("");
      setSuccess("");
      setBtnCreateLoading(true);
      
      const res = await fetch(createURL, {
        method: "POST",
        body: JSON.stringify(beautifySchema(schema))
      });
      
      if (res.status !== 201) {
        const json = await res.json();
        setError(`An error occourd, ${json.error}`);
      } else {
        setSuccess(`Successfully created ${name}.`);
      }
      
      setBtnCreateLoading(false);
      bootstrap.Modal.getInstance("#bulkCreateModal").hide()
    }, [schema]);

    const loadTemplate = useCallback((template) => () => {
      setSchema(template.template);
    }, []);

    return html`
      <div>
        <div class="card mb-2">
          <div class="card-header">
            <h5 class="mb-0 user-select-none" role="button" data-bs-toggle="collapse" data-bs-target="#accordion-saved-templates">
              Saved templates
            </h5>
          </div>

          <div id="accordion-saved-templates" class="collapse show">
            <div class="card-body">
              <table class="table table-bordered" style="max-width: 500px">
                <thead>
                  <th>Name</th>
                  <th>Actions</th>
                </thead>
                <tbody>
                  ${isLoading ? html`
                  <tr>
                    <td colspan="2">
                      <div class="d-flex justify-content-center">
                        <div class="spinner-border" role="status">
                          <span class="visually-hidden">Loading...</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                  ` : savedTemplates.map(template => html`
                  <tr>
                    <td>${template.name}</td>
                    <td>
                      <button class="btn btn-sm btn-outline-success" onClick=${loadTemplate(template)}>Load</button>
                    </td>
                  </tr>
                  `)}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        ${generateKeys !== null && html`<${BulkDefinitionSchemaBuilder} schema=${schema} setSchema=${setSchema} generateKeys=${generateKeys} />`}

        <div class="mt-3">
          ${success && html`<div class="alert alert-success">${success}</div>`}
          ${error && html`<div class="alert alert-danger">${error}</div>`}

          <button type="button" class="btn btn-primary" onClick=${onPreview} disabled=${btnPreviewLoading}>
            <span class="spinner-border spinner-border-sm loadingindicator me-1" style="${btnPreviewLoading ? 'display: inline-block;' : ''}" role="status" aria-hidden="true" id="loadingindicator-preview"></span>
            Preview
          </button>
          <button type="button" class="btn btn-outline-primary ms-2" data-bs-toggle="modal" data-bs-target="#bulkCreateModal">
            Create
          </button>
        </div>

        <div class="modal fade" id="bulkCreateModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h1 class="modal-title fs-5" id="exampleModalLabel">Bulk create ${name}</h1>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                Are you sure you want to bulk generate sub-${name} here?
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" disabled=${btnCreateLoading}>Close</button>
                <button type="button" class="btn btn-primary" onClick=${onCreate} disabled=${btnCreateLoading}>
                  <span class="spinner-border spinner-border-sm loadingindicator me-1" style="${btnCreateLoading ? 'display: inline-block;' : ''}" role="status" aria-hidden="true" id="loadingindicator-create"></span>
                  Bulk generate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  render(html`<${App} />`, target);
}
