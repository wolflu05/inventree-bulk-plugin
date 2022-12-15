const { render, h } = window.preact;
const { useState, useCallback, useEffect, useMemo, useId } = window.preactHooks;
const html = window.htm.bind(h);

// helpers
const beautifyChildSchema = (childSchema) => {
  const out = { ...childSchema };

  for(const k of ["parent_name_match", "extends"]) {
    if(out[k] === "") {
      delete out[k];
    }
  }

  out.count = childSchema.count.map(c => c || null);
  out.childs = childSchema.childs.map(beautifyChildSchema);

  return out;
};
const beautifySchema = (schema) => {
  return {
    ...schema,
    templates: schema.templates.map(beautifyChildSchema),
    output: beautifyChildSchema(schema.output)
  }
}

// Components
function BulkDefinitionSchemaBuilder({ schema, setSchema, generateKeys = [] }) {
  // initially populate schema if null
  useEffect(() => {
    if (schema === null) {
      setSchema({
        version: "0.1.0",
        input: {},
        settings: {
          count_from: 1,
          leading_zeros: true
        },
        templates: [],
        output: null,
      })
    }
  }, [schema]);

  const setChildSchema = useCallback((newSchema) => setSchema(s =>
    ({ ...s, output: newSchema(s.output) })), [setSchema]);
  const setSetting = useCallback((key, k = "value") => (e) => setSchema(s =>
    ({ ...s, settings: { ...s.settings, [key]: e.target[k] } })), [setSchema]);
      
  // input
  const [input, setInput] = useState([]);
  const setInputKey = useCallback((i, key) => (e) => setInput(inp => {
    inp[i][key] = e.target.value;
    return [...inp];
  }), [setInput]);
  const addInput = useCallback(() => 
    setInput(inp => [...inp, { key: "", value: ""}]), [setInput]);
  const removeInput = useCallback((n) => () => 
    setInput(inp => inp.filter((_,i) => i !== n))
  , [setInput]);
  // hook input array state up to schema.input as an object
  useEffect(() => {
    setSchema(s => ({...s, input: Object.fromEntries(input.map(({key, value}) => [key,value]))}))
  }, [input, setSchema])

  // template
  const setTemplate = useCallback((i) => (newTemplate) => setSchema(s => {
    s.templates[i] = newTemplate(s.templates[i]);
    return { ...s, templates: s.templates };
  }), [setSchema]);
  const addTemplate = useCallback(() => 
    setSchema(s => {
      s.templates.push(null);
      return { ...s, templates: s.templates };
    }), [setSchema]);
  const removeTemplate = useCallback((n) => () => 
    setSchema(s => ({ ...s, templates: s.templates.filter((_,i) => i !== n) })
  ), [setSchema]);

  // cache extendsKeys
  const extendsKeys = useMemo(() => ({
    "": "---", 
    ...(schema ? Object.fromEntries(schema.templates.filter(x=> x && x.name).map(t => [t.name, t.name])): {})
  }), [schema]);

  // unique identifier if BulkDefinitionSchemaBuilder is used multiple times on same DOM
  const accordionId = useId();

  if (schema === null) {
    return ""
  }

  return html`
    <div>
      <div class="card">
        <div class="card-header">
          <h5 class="mb-0 user-select-none" role="button" data-bs-toggle="collapse" data-bs-target=${`#accordion-${accordionId}-input`}>
            Input
          </h5>
        </div>

        <div id=${`accordion-${accordionId}-input`} class="collapse">
          <div class="card-body">
            ${input.map((inp, i) => html`
              <div class="input-group mb-2">
                <span class="input-group-text">Key/Value</span>
                <input type="text" value=${inp.key} onInput=${setInputKey(i, "key")}/>
                <input type="text" value=${inp.value} onInput=${setInputKey(i, "value")}/>
                <button class="btn btn-outline-danger btn-sm" onClick=${removeInput(i)}>X</button>
              </div>
            `)}

            <button onClick=${addInput} class="btn btn-outline-primary btn-sm">Add input</button>
          </div>
        </div>
      </div>

      <div class="card mt-2">
        <div class="card-header">
          <h5 class="mb-0 user-select-none" role="button" data-bs-toggle="collapse" data-bs-target=${`#accordion-${accordionId}-settings`}>
            Settings
          </h5>
        </div>

        <div id=${`accordion-${accordionId}-settings`} class="collapse">
          <div class="card-body">
            <${Input} label="Count from" tooltip="Number where to start counting the dimensions" type="number" value=${schema.settings.count_from} onInput=${setSetting("count_from")} />
            <${Input} label="Leading zeros" tooltip="Add leading zeros " type="checkbox" value=${schema.settings.leading_zeros} onInput=${setSetting("leading_zeros", "checked")} />
          </div>
        </div>
      </div>

      <div class="card mt-2">
        <div class="card-header">
          <h5 class="mb-0 user-select-none" role="button" data-bs-toggle="collapse" data-bs-target=${`#accordion-${accordionId}-templates`}>
            Templates
          </h5>
        </div>

        <div id=${`accordion-${accordionId}-templates`} class="collapse">
          <div class="card-body">
            ${schema.templates.map((template, i) => html`
              <div class="card mb-2">
                <div class="d-flex justify-content-between">
                  <div class="col p-3">
                    ${template !== null && html`<${Input} label="Template name" type="text" value=${template.name} onInput=${(e) => setTemplate(i)(t => ({...t, name: e.target.value}))} />`}
                    <${BulkDefinitionChildSchemaBuilder} childSchema=${template} setChildSchema=${setTemplate(i)} generateKeys=${generateKeys} extendsKeys=${extendsKeys} addNameField=${true} />
                  </div>
                  <div class="p-1">
                    <button onClick=${removeTemplate(i)} class="btn btn-outline-danger">X</button>
                  </div>
                </div>
              </div>
            `)}
            <button onClick=${addTemplate} class="btn btn-outline-primary btn-sm">Add template</button>
          </div>
        </div>
      </div>

      <div class="card mt-2">
        <div class="card-header">
          <h5 class="mb-0 user-select-none" role="button" data-bs-toggle="collapse" data-bs-target=${`#accordion-${accordionId}-output`}>
            Output
          </h5>
        </div>

        <div id=${`accordion-${accordionId}-output`} class="collapse show">
          <div class="card-body">
            <${BulkDefinitionChildSchemaBuilder} childSchema=${schema.output} setChildSchema=${setChildSchema} generateKeys=${generateKeys} extendsKeys=${extendsKeys} />
          </div>
        </div>
      </div>
    </div>
  `;
}

function BulkDefinitionChildSchemaBuilder({ childSchema, setChildSchema, generateKeys, extendsKeys, addNameField = false }) {
  // initially populate childSchema with values
  useEffect(() => {
    if (childSchema === null) {
      setChildSchema(_=>({
        parent_name_match: ".*",
        ...(addNameField ? {name: ""} : {}),
        ...(extendsKeys ? {extends: ""} : {}),
        dimensions: [],
        count: [],
        generate: Object.fromEntries(generateKeys.map(k => [k, ""])),
        childs: []
      }))
    }
  }, [childSchema, generateKeys])

  // setValue callback for inputs, accepts key and event
  const setValue = useCallback((key) => (e) => setChildSchema(s => ({ ...s, [key]: e.target.value })), [setChildSchema]);
  
  // set a generated value by key and event
  const setGenerateValue = useCallback((key) => (e) => setChildSchema(s => ({ ...s, generate: { ...s.generate, [key]: e.target.value }})), [setChildSchema]);
  
  // dimensions
  const setDimension = useCallback((key) => (i) => (newValue) => setChildSchema(s => {
    s[key][i] = newValue(s[key][i]);
    return { ...s, [key]: s[key] };
  }), [setChildSchema]);
  const addDimension = useCallback(() => 
    setChildSchema(s => {
      s.dimensions.push("");
      s.count.push("");
      return { ...s, dimensions: s.dimensions, count: s.count };
    }), [setChildSchema]);
  const removeDimension = useCallback((n) => () => 
    setChildSchema(s => ({ ...s, dimensions: s.dimensions.filter((_,i) => i !== n), count: s.count.filter((_,i) => i !== n) })
  ), [setChildSchema]);
  
  // child's childs schemas
  const setChildChildSchema = useCallback((i) => (newValue) => setChildSchema(s => {
    s.childs[i] = newValue(s.childs[i]);
    return { ...s, childs: s.childs };
  }), [setChildSchema]);
  const addChild = useCallback(() => 
    setChildSchema(s => {
      s.childs.push(null);
      return { ...s, childs: s.childs };
    }), [setChildSchema]);
  const removeChild = useCallback((n) => () => 
    setChildSchema(s => ({ ...s, childs: s.childs.filter((_,i) => i !== n) })
  ), [setChildSchema]);

  if (childSchema === null) {
    return "";
  }

  return html`
    <div class="">
      <${Input} label="Parent name match" tooltip="First child that matches the parent name matcher will be choosen for generating the childs for a specific parent" type="text" value=${childSchema.parent_name_match} onInput=${setValue("parent_name_match")} />
      ${extendsKeys && html`<${Input} label="Extends" tooltip="Choose to extend from a template" type="select" options=${extendsKeys} value=${childSchema.extends} onInput=${setValue("extends")} />`}
      <${Input} label="Dimensions" tooltip="A childs naming convention could have multiple dimensions where it is counting in" type="array" onDelete=${removeDimension} value=${childSchema.dimensions} onInput=${setDimension("dimensions")} />
      <${Input} label="Count" tooltip="Limit the amount of generated items for the individual dimension" type="array" value=${childSchema.count} onInput=${setDimension("count")} />
      <button onClick=${addDimension} class="btn btn-outline-primary btn-sm">Add dimension</button>
      
      <div class="mt-4">
        <${Tooltip} text="You can use {dim.x} as a placeholder for the generated output of the dimension and {inp.KEY} for replacing with the given input value.">
          <h5>Generate</h5>
          <//>
      </div>
      ${generateKeys.map(k => html`
        <${Input} label="Generate ${k}" type="text" value=${childSchema.generate[k]} onInput=${setGenerateValue(k)} />
      `)}

      <div class="ms-4 mt-2">
        <h5>Childs</h5>
        ${childSchema.childs.map((child, i) => html`
          <div class="card mb-2">
            <div class="d-flex justify-content-between">
              <div class="col p-3">
                <${BulkDefinitionChildSchemaBuilder} childSchema=${child} setChildSchema=${setChildChildSchema(i)} generateKeys=${generateKeys} extendsKeys=${extendsKeys} />
              </div>
              <div class="p-1">
                <button onClick=${removeChild(i)} class="btn btn-outline-danger">X</button>
              </div>
            </div>
          </div>
        `)}
        <button onClick=${addChild} class="btn btn-outline-primary btn-sm">Add child</button>
      </div>
    </div>
  `;
}

function Input({ type, label, tooltip, options, ...inputProps }) {
  const id = useId();

  return html`
    <div class="form-group row">
      <div class="col-sm-2">
        <${Tooltip} text=${tooltip}>
          <label for="input-${id}" class="col-form-label col-form-label-sm">${label}</label>
        <//>
      </div>
      ${(() => {
          if (["text", "email", "number"].includes(type)) {
            return html`
              <div class="col-sm-10">
                <input type=${type} class="form-control form-control-sm" id="input-${id}" ...${inputProps} />
              </div>
            `;
          } else if (type === "checkbox") {
            return html`
              <div class="col-sm-10">
                <input type=${type} class="form-check-input form-check-sm" id="input-${id}" checked=${inputProps.value} ...${inputProps}/>
              </div>
            `;
          } else if (type === "select") {
            return html`
              <div class="col-sm-10">
                <select class="form-select form-select-sm" id="input-${id}" ...${inputProps}>
                  ${Object.entries(options).map(([k, v]) => html`
                    <option value=${k}>${v}</option>
                  `)}
                </select>
              </div>
            `;
          } else if (type === "array") {
            return html`
              <div class="col-sm-10">
                <div class="d-flex flex-row flex-nowrap" style="gap: 4px">
                  ${inputProps.value.map((v, i) => html`
                    <div class="input-group" style="max-width: 200px">
                      <input type="text" class="form-control form-control-sm" id="input-${id}-${i}" value=${v} onInput=${(e) => inputProps.onInput(i)(_=>e.target.value)} />
                      ${inputProps.onDelete && html`<button class="btn btn-outline-danger btn-sm" onClick=${inputProps.onDelete(i)}>X</button>`}
                    </div>
                  `)}
                </div>
              </div>
            `;
          } else {
            return html`Not implemented`;
          }
        })()}
    </div>
  `;
}

function Tooltip({ text, children }) {
  if(!text) {
    return html`${children}`;
  }

  return html`
    <div class="preact-tooltip">
      ${children}
      <span class="preact-tooltiptext">${text}</span>
    </div>
  `;
}

const styles = `
/* Tooltips - (Prefixed so the classes doesn't interfer with bootstraps classes) */
.preact-tooltip {
  position: relative;
  display: inline-block;
}

.preact-tooltip .preact-tooltiptext {
  visibility: hidden;
  width: 350px;
  background-color: black;
  color: #fff;
  border-radius: 6px;
  padding: 5px;
  opacity: 0;
  transition: 50ms all;
  
  /* Position the tooltip */
  position: absolute;
  z-index: 1000;
  top: -5px;
  left: 105%;
}

.preact-tooltip:hover .preact-tooltiptext {
  visibility: visible;
  opacity: 1;
}
`;
const styleSheet = document.createElement("style");
styleSheet.innerHTML = styles;
document.head.appendChild(styleSheet);
