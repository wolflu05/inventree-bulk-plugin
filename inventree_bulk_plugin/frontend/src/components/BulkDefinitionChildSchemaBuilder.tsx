import { JSX } from "preact";
import { useState, useCallback, useEffect, useMemo, useId, StateUpdater } from "preact/hooks";

import { Input } from "./Input";
import { Tooltip } from "./Tooltip";
import { defaultSchema } from "../utils/constants";
import { BulkDefinitionChild, GenerateKeys } from "../utils/types";

import "./BulkDefinitionChildSchemaBuilder.css";

export const typeHelpTexts = {
  boolean: "This must evaluate to something that can be casted to a boolean (e.g. 'true' or 'false').",
  number: "This must evaluate to something that can be casted as number.",
  text: "",
};

interface BulkDefinitionChildSchemaBuilderProps {
  childSchema: BulkDefinitionChild;
  setChildSchema: StateUpdater<BulkDefinitionChild>;
  generateKeys: GenerateKeys;
  extendsKeys: Record<string, string>;
}

export function BulkDefinitionChildSchemaBuilder({
  childSchema,
  setChildSchema,
  generateKeys,
  extendsKeys,
}: BulkDefinitionChildSchemaBuilderProps) {
  // initially populate childSchema with values
  useEffect(() => {
    if (Object.keys(childSchema.generate).length === 0) {
      setChildSchema((s) => ({
        ...s,
        generate: Object.fromEntries(
          Object.entries(generateKeys)
            .filter(([, { required }]) => !!required)
            .map(([k]) => [k, ""]),
        ),
      }));
    }
  }, [childSchema, generateKeys, setChildSchema]);

  // setValue callback for inputs, accepts key and event
  const setValue = useCallback(
    (key: string) => (e: JSX.TargetedEvent<HTMLInputElement, Event>) =>
      setChildSchema((s) => ({ ...s, [key]: e.currentTarget.value })),
    [setChildSchema],
  );

  // set a generated value by key and event
  const setGenerateValue = useCallback(
    (key: string) => (value: string) => setChildSchema((s) => ({ ...s, generate: { ...s.generate, [key]: value } })),
    [setChildSchema],
  );

  const remainingGenerateKeys = useMemo(() => {
    const currentKeys = Object.keys(childSchema?.generate || {});
    return Object.entries(generateKeys).filter(([k]) => !currentKeys.includes(k));
  }, [generateKeys, childSchema?.generate]);

  const [remainingGenerateKeysValue, setRemainingGenerateKeysValue] = useState("");

  const handleAddGenerateKey = useCallback(
    (key: string) => {
      if (key !== "") {
        setGenerateValue(key)("");
        setRemainingGenerateKeysValue("");
      }
    },
    [setGenerateValue, setRemainingGenerateKeysValue],
  );

  const handleDeleteGenerateKey = useCallback(
    (key: string) => () => {
      setChildSchema((s) => ({
        ...s,
        generate: Object.fromEntries(Object.entries(s.generate).filter(([k]) => k !== key)),
      }));
    },
    [setChildSchema],
  );

  // dimensions
  const setDimension: (key: "dimensions" | "count") => (i: number) => StateUpdater<string | null> = useCallback(
    (key) => (i) => (newValue) =>
      setChildSchema((s) => {
        s[key][i] = typeof newValue === "function" ? newValue(s[key][i]) : newValue;
        return { ...s, [key]: s[key] };
      }),
    [setChildSchema],
  );
  const addDimension = useCallback(
    () =>
      setChildSchema((s) => {
        s.dimensions.push("");
        s.count.push("");
        return { ...s, dimensions: s.dimensions, count: s.count };
      }),
    [setChildSchema],
  );
  const removeDimension = useCallback(
    (n: number) => () =>
      setChildSchema((s) => ({
        ...s,
        dimensions: s.dimensions.filter((_, i) => i !== n),
        count: s.count.filter((_, i) => i !== n),
      })),
    [setChildSchema],
  );

  // child's childs schemas
  const setChildChildSchema: (i: number) => StateUpdater<BulkDefinitionChild> = useCallback(
    (i) => (newValue) =>
      setChildSchema((s) => {
        if (!s.childs) s.childs = [];
        s.childs[i] = typeof newValue === "function" ? newValue(s.childs[i]) : newValue;
        return { ...s, childs: s.childs };
      }),
    [setChildSchema],
  );
  const addChild = useCallback(
    () =>
      setChildSchema((s) => {
        if (!s.childs) s.childs = [];
        s.childs.push(structuredClone(defaultSchema.output));
        return { ...s, childs: s.childs };
      }),
    [setChildSchema],
  );
  const removeChild = useCallback(
    (n: number) => () =>
      setChildSchema((s) => {
        if (!s.childs) return s;
        return { ...s, childs: s.childs.filter((_, i) => i !== n) };
      }),
    [setChildSchema],
  );

  // collapsable handling for advanced child options
  const id = useId();
  const outputAdvancedId = `bulk-child-schema-editor-${id}`;
  const [outputAdvancedState, setOutputAdvancedState] = useState(false);

  const onOutputAdvanceToggle = useCallback(() => {
    setOutputAdvancedState((oldState) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: correct types for bootstrap table are not available
      $(`#${outputAdvancedId}`).collapse(!oldState ? "show" : "hide");
      return !oldState;
    });
  }, [outputAdvancedId]);

  return (
    <div class="">
      <Input
        label="Dimensions"
        tooltip="A childs naming convention could have multiple dimensions where it is counting in"
        type="array"
        onDelete={removeDimension}
        value={childSchema.dimensions.map((x) => x || "")}
        onInput={setDimension("dimensions")}
        onAdd={addDimension}
      />
      <Input
        label="Count"
        tooltip="Limit the amount of generated items for the individual dimension"
        type="array"
        value={childSchema.count.map((x) => x || "")}
        onInput={setDimension("count")}
      />

      <h6
        class={`user-select-none collapsable-heading ${outputAdvancedState ? "active" : ""}`}
        role="button"
        onClick={onOutputAdvanceToggle}
      >
        Advanced
      </h6>
      <div class="collapse" id={outputAdvancedId}>
        <Input
          label="Parent name match"
          tooltip="First child that matches the parent name matcher will be chosen for generating the childs for a specific parent. Must evalueate to something that can be casted to a boolean."
          type="text"
          value={childSchema.parent_name_match || ""}
          onInput={setValue("parent_name_match")}
        />
        {extendsKeys && (
          <Input
            label="Extends"
            tooltip="Choose to extend from a template"
            type="select"
            options={extendsKeys}
            value={childSchema.extends || ""}
            onInput={setValue("extends")}
          />
        )}
      </div>

      <div class="mt-3">
        <Tooltip
          text={`You can use {{dim.x}} as a placeholder for the generated output of the dimension. For more info see the Readme.`}
        >
          <h5>Generate</h5>
        </Tooltip>
      </div>
      {Object.entries(generateKeys)
        .filter(([key]) => childSchema.generate[key] !== undefined)
        .map(([key, { name, required, type }]) => (
          <Input
            label={name}
            tooltip={typeHelpTexts[type]}
            type="text"
            value={childSchema.generate[key]}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => setGenerateValue(key)(e.currentTarget.value)}
            onDelete={required ? undefined : handleDeleteGenerateKey(key)}
          />
        ))}
      {remainingGenerateKeys.length > 0 && (
        <div style="display: flex; max-width: 200px;">
          <select
            class="form-select form-select-sm"
            value={remainingGenerateKeysValue}
            onInput={(e) => handleAddGenerateKey(e.currentTarget.value)}
          >
            <option selected value="">
              Add key
            </option>
            {remainingGenerateKeys.map(([key, { name }]) => (
              <option value={key}>{name}</option>
            ))}
          </select>
        </div>
      )}

      <h5 class="mt-3">Childs</h5>
      <div class="ms-3">
        {childSchema.childs?.map((child, i) => (
          <div class="card mb-2">
            <div class="d-flex justify-content-between">
              <div class="col p-3">
                <BulkDefinitionChildSchemaBuilder
                  childSchema={child}
                  setChildSchema={setChildChildSchema(i)}
                  generateKeys={generateKeys}
                  extendsKeys={extendsKeys}
                />
              </div>
              <div class="p-1">
                <button onClick={removeChild(i)} class="btn btn-outline-danger">
                  X
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={addChild} class="btn btn-outline-primary btn-sm">
        Add child
      </button>
    </div>
  );
}
