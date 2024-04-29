import { JSX } from "preact";
import { useState, useCallback, useEffect, useMemo, useId, useRef, StateUpdater, Dispatch } from "preact/hooks";

import { BulkDefinitionChildSchemaBuilder } from "./BulkDefinitionChildSchemaBuilder";
import { Input } from "./Input";
import { defaultSchema } from "../utils/constants";
import {
  BulkDefinitionChild,
  BulkDefinitionChildTemplate,
  BulkDefinitionSchema,
  BulkGenerateInfo,
} from "../utils/types";

interface BulkDefinitionSchemaBuilderProps {
  schema: BulkDefinitionSchema;
  setSchema: Dispatch<StateUpdater<BulkDefinitionSchema>>;
  bulkGenerateInfo: BulkGenerateInfo;
}

export function BulkDefinitionSchemaBuilder({ schema, setSchema, bulkGenerateInfo }: BulkDefinitionSchemaBuilderProps) {
  const firstUpdate = useRef(true);

  const setChildSchema: Dispatch<StateUpdater<BulkDefinitionChild>> = useCallback(
    (newSchema) =>
      setSchema((s) => ({ ...s, output: typeof newSchema === "function" ? newSchema(s.output) : newSchema })),
    [setSchema],
  );

  // input
  type InputType = { key: string; value: string };
  const [input, setInput] = useState<InputType[]>([]);
  const setInputKey = useCallback(
    (i: number, key: keyof InputType) => (e: JSX.TargetedEvent<HTMLInputElement, Event>) =>
      setInput((inp) => {
        inp[i][key] = e.currentTarget.value;
        return [...inp];
      }),
    [setInput],
  );
  const addInput = useCallback(() => setInput((inp) => [...inp, { key: "", value: "" }]), [setInput]);
  const removeInput = useCallback((n: number) => () => setInput((inp) => inp.filter((_, i) => i !== n)), [setInput]);
  // hook input array state up to schema.input as an object
  useEffect(() => {
    if (input.length > 0) {
      setSchema((s) => ({ ...s, input: Object.fromEntries(input.map(({ key, value }) => [key, value])) }));
    }
  }, [input, setSchema]);
  // load input on initial load
  useEffect(() => {
    if (firstUpdate.current && schema?.input && Object.keys(schema.input).length !== 0) {
      setInput(Object.entries(schema.input).map(([key, value]) => ({ key, value })));
      firstUpdate.current = false;
    }
  }, [schema?.input, input, setInput]);

  // template
  const setTemplate: (i: number) => Dispatch<StateUpdater<BulkDefinitionChildTemplate>> = useCallback(
    (i: number) => (newTemplate) =>
      setSchema((s) => {
        s.templates[i] = typeof newTemplate === "function" ? newTemplate(s.templates[i]) : newTemplate;
        return { ...s, templates: s.templates };
      }),
    [setSchema],
  );
  const addTemplate = useCallback(
    () =>
      setSchema((s) => {
        s.templates.push({ name: "", ...structuredClone(defaultSchema.output) });
        return { ...s, templates: s.templates };
      }),
    [setSchema],
  );
  const removeTemplate = useCallback(
    (n: number) => () => setSchema((s) => ({ ...s, templates: s.templates.filter((_, i) => i !== n) })),
    [setSchema],
  );

  // cache extendsKeys
  const extendsKeys = useMemo(
    () => ({
      "": "---",
      ...(schema ? Object.fromEntries(schema.templates.filter((x) => x && x.name).map((t) => [t.name, t.name])) : {}),
    }),
    [schema],
  );

  // unique identifier if BulkDefinitionSchemaBuilder is used multiple times on same DOM
  const accordionId = useId();

  return (
    <div>
      <div class="card">
        <div class="card-header">
          <h5
            class="mb-0 user-select-none"
            role="button"
            data-bs-toggle="collapse"
            data-bs-target={`#accordion-${accordionId}-input`}
          >
            Input
          </h5>
        </div>

        <div id={`accordion-${accordionId}-input`} class="collapse">
          <div class="card-body">
            {input.map((inp, i) => (
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Key</span>
                <input type="text" value={inp.key} onInput={setInputKey(i, "key")} />
                <span class="input-group-text">Value</span>
                <input type="text" style="flex: 1;" value={inp.value} onInput={setInputKey(i, "value")} />
                <button class="btn btn-outline-danger btn-sm" onClick={removeInput(i)}>
                  <i class="fa fa-trash"></i>
                </button>
              </div>
            ))}

            <button onClick={addInput} class="btn btn-outline-primary btn-sm">
              Add input
            </button>
          </div>
        </div>
      </div>

      {bulkGenerateInfo.generate_type === "tree" && (
        <>
          <div class="card mt-2">
            <div class="card-header">
              <h5
                class="mb-0 user-select-none"
                role="button"
                data-bs-toggle="collapse"
                data-bs-target={`#accordion-${accordionId}-templates`}
              >
                Templates
              </h5>
            </div>

            <div id={`accordion-${accordionId}-templates`} class="collapse">
              <div class="card-body">
                {schema.templates.map((template, i) => (
                  <div class="card mb-2">
                    <div class="d-flex justify-content-between">
                      <div class="col p-3">
                        {template !== null && (
                          <Input
                            label="Template name"
                            type="text"
                            value={template.name}
                            onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) =>
                              setTemplate(i)((t) => ({ ...t, name: e.currentTarget.value }))
                            }
                          />
                        )}
                        <BulkDefinitionChildSchemaBuilder
                          childSchema={template}
                          setChildSchema={setTemplate(i) as unknown as Dispatch<StateUpdater<BulkDefinitionChild>>}
                          bulkGenerateInfo={bulkGenerateInfo}
                          extendsKeys={extendsKeys}
                        />
                      </div>
                      <div class="p-1">
                        <button onClick={removeTemplate(i)} class="btn btn-sm btn-outline-danger">
                          <i class="fa fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addTemplate} class="btn btn-outline-primary btn-sm">
                  Add template
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div class="card mt-2">
        <div class="card-header">
          <h5
            class="mb-0 user-select-none"
            role="button"
            data-bs-toggle="collapse"
            data-bs-target={`#accordion-${accordionId}-output`}
          >
            Output
          </h5>
        </div>

        <div id={`accordion-${accordionId}-output`} class="collapse show">
          <div class="card-body">
            <BulkDefinitionChildSchemaBuilder
              childSchema={schema.output}
              setChildSchema={setChildSchema}
              bulkGenerateInfo={bulkGenerateInfo}
              extendsKeys={extendsKeys}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
