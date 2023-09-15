import { JSX } from "preact";
import { StateUpdater, useCallback, useId, useMemo, useState } from "preact/hooks";

import { Input } from "./Input";
import { Tooltip } from "./Tooltip";
import {
  FieldDefinition,
  FieldDefinitionList,
  FieldDefinitionModel,
  FieldDefinitionObject,
  FieldDefinitionSelect,
  FieldDefinitionText,
  FieldType,
} from "../utils/types";

const getDefaultValue = (fieldDefinition: FieldDefinition): FieldType => {
  // use potential default value that is available via API
  if (fieldDefinition.default) return fieldDefinition.default;

  if (fieldDefinition.field_type === "list") {
    return [getDefaultValue(fieldDefinition.items_type)];
  } else if (fieldDefinition.field_type === "object") {
    return Object.fromEntries(
      Object.entries(fieldDefinition.fields)
        .filter(([, f]) => f.required)
        .map(([k, f]) => [k, getDefaultValue(f)]),
    );
  } else if (fieldDefinition.field_type === "boolean") {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return false;
  } else if (fieldDefinition.field_type === "float") {
    return "0";
  } else if (fieldDefinition.field_type === "number") {
    return "0";
  }
  return "";
};

interface GenerateKeysProps {
  fieldDefinition: FieldDefinition;
  field: FieldType;
  setField: StateUpdater<FieldType>;
  onDelete?: () => void;
}

export const GenerateKeys = ({ fieldDefinition, field, setField, onDelete }: GenerateKeysProps) => {
  if (fieldDefinition.field_type === "object") {
    return (
      <GenerateKeysObject
        fieldsDefinition={fieldDefinition}
        fields={field as Record<string, FieldType>}
        setFields={setField as StateUpdater<Record<string, FieldType>>}
        onDelete={onDelete}
      />
    );
  }
  if (fieldDefinition.field_type === "list") {
    return (
      <GenerateKeysList
        fieldsDefinition={fieldDefinition}
        fields={field as FieldType[]}
        setFields={setField as StateUpdater<FieldType[]>}
        onDelete={onDelete}
      />
    );
  }

  return <GenerateKeysSingle fieldDefinition={fieldDefinition} field={field} setField={setField} onDelete={onDelete} />;
};

interface GenerateKeysListProps {
  fieldsDefinition: FieldDefinitionList;
  fields: FieldType[];
  setFields: StateUpdater<FieldType[]>;
  onDelete?: () => void;
}
export const GenerateKeysList = ({ fieldsDefinition, fields, setFields, onDelete }: GenerateKeysListProps) => {
  const itemsFieldsDefinition = fieldsDefinition.items_type;
  const setField = useCallback(
    (i: number) => (value: FieldType | ((prevState: FieldType) => FieldType)) => {
      setFields((fields) => {
        const copy = [...fields];
        copy[i] = typeof value === "function" ? value(copy[i]) : value;
        return copy;
      });
    },
    [setFields],
  );

  const handleAddGenerateKey = useCallback(() => {
    const defaultValue = getDefaultValue(itemsFieldsDefinition);
    setFields((f) => [...f, defaultValue]);
  }, [itemsFieldsDefinition, setFields]);

  const handleDeleteGenerateKey = useCallback(
    (i: number) => () => {
      setFields((fields) => fields.filter((_f, ii) => i !== ii));
    },
    [setFields],
  );

  return (
    <div class="mb-1 card">
      <div class="d-flex justify-content-between">
        <div className="col p-2">
          {fieldsDefinition.name && (
            <Tooltip text={fieldsDefinition.description || ""}>
              <h6>{fieldsDefinition.name}</h6>
            </Tooltip>
          )}
          <div class="ms-3">
            {fields.map((field, i) => (
              <GenerateKeys
                fieldDefinition={itemsFieldsDefinition}
                field={field}
                setField={setField(i)}
                onDelete={handleDeleteGenerateKey(i)}
              />
            ))}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button class="btn btn-sm btn-outline-primary" onClick={handleAddGenerateKey}>
                Add {fieldsDefinition.name}
              </button>
            </div>
          </div>
        </div>
        {onDelete && (
          <div class="p-1">
            <button onClick={onDelete} class="btn btn-sm btn-outline-danger">
              <i class="fa fa-trash"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface GenerateKeysObjectProps {
  fieldsDefinition: FieldDefinitionObject;
  fields: Record<string, FieldType>;
  setFields: StateUpdater<Record<string, FieldType>>;
  onDelete?: () => void;
  showCard?: boolean;
}
export const GenerateKeysObject = ({
  fieldsDefinition,
  fields,
  setFields,
  onDelete,
  showCard = true,
}: GenerateKeysObjectProps) => {
  const subFieldsDefinition = fieldsDefinition.fields;
  const setGenerateValue = useCallback(
    (key: string) => (value: FieldType | ((prevState: FieldType) => FieldType)) =>
      setFields((f) => ({ ...f, [key]: typeof value === "function" ? value(f[key]) : value })),
    [setFields],
  );

  const remainingGenerateKeys = useMemo(() => {
    const currentKeys = Object.keys(fields);
    return Object.entries(subFieldsDefinition).filter(([k]) => !currentKeys.includes(k));
  }, [fields, subFieldsDefinition]);

  const [remainingGenerateKeysValue, setRemainingGenerateKeysValue] = useState("");

  const handleAddGenerateKey = useCallback(
    (key: string) => {
      if (key !== "") {
        const field = subFieldsDefinition[key];
        const defaultValue = getDefaultValue(field);
        setGenerateValue(key)(defaultValue);
        setRemainingGenerateKeysValue("");
      }
    },
    [subFieldsDefinition, setGenerateValue],
  );

  const handleDeleteGenerateKey = useCallback(
    (key: string) => () => {
      setFields((f) => {
        const copy = { ...f };
        delete copy[key];
        return copy;
      });
    },
    [setFields],
  );

  return (
    <div class={`${showCard ? "card mb-1" : ""}`}>
      <div class="d-flex justify-content-between">
        <div class={`col ${showCard ? "p-2" : ""}`}>
          {fieldsDefinition.name && (
            <Tooltip text={fieldsDefinition.description || ""}>
              <h6>{fieldsDefinition.name}</h6>
            </Tooltip>
          )}
          {Object.entries(subFieldsDefinition)
            .filter(([key]) => fields[key] !== undefined)
            .map(([key, fieldDefinition]) => {
              const value = fields[key];

              return (
                <GenerateKeys
                  key={key}
                  fieldDefinition={fieldDefinition}
                  field={value}
                  setField={setGenerateValue(key)}
                  onDelete={fieldDefinition.required ? undefined : handleDeleteGenerateKey(key)}
                />
              );
            })}
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
        </div>
        {onDelete && (
          <div class="p-1">
            <button onClick={onDelete} class="btn btn-sm btn-outline-danger">
              <i class="fa fa-trash"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const getTemplateHelpTexts = (fieldDefinition: FieldDefinition): string => {
  if (fieldDefinition.field_type === "boolean") {
    return "Use a template that evaluates to something boolean like (e.g. 'true' or 'false').";
  }
  if (fieldDefinition.field_type === "number") {
    return "Use a template that evaluates to something number like (e.g. '10').";
  }
  if (fieldDefinition.field_type === "float") {
    return "Use a template that evaluates to something float like (e.g. '3.1415').";
  }
  if (fieldDefinition.field_type === "model") {
    const extraString = fieldDefinition.allow_multiple
      ? "The filters can also return multiple objects."
      : "The filters must return only one object.";
    return `Use a template that evaluates to a valid id for this model (e.g. '42') or a json string containing django model filters (e.g. {"name": "R_10k_0808_10%"} or {"name__startswith": "R_"}), but be aware that the preview table may not work correctly due to API limitations. Bulk create will work correctly then. ${extraString}`;
  }
  if (fieldDefinition.field_type === "select") {
    return `Use a template that evaluates to a valid option from the select field. Available options: ${Object.keys(
      fieldDefinition.options,
    ).join(", ")}`;
  }

  return "";
};

const detectUseTemplate = (
  fieldDefinition: FieldDefinitionText | FieldDefinitionModel | FieldDefinitionSelect,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
) => {
  const valueStr = `${value}`;
  if (fieldDefinition.field_type === "number") return !/^\d*$/.test(valueStr);
  if (fieldDefinition.field_type === "float") return !/^[\d\\.,]*$/.test(valueStr);
  if (fieldDefinition.field_type === "boolean") return !["true", "false", ""].includes(valueStr);
  return valueStr.includes("{") || valueStr.includes("}");
};

interface GenerateKeysSingleProps {
  fieldDefinition: FieldDefinitionText | FieldDefinitionModel | FieldDefinitionSelect;
  field: FieldType;
  setField: StateUpdater<FieldType>;
  onDelete?: () => void;
}
const GenerateKeysSingle = ({ fieldDefinition, field, setField, onDelete }: GenerateKeysSingleProps) => {
  const [useTemplate, setUseTemplate] = useState(() => detectUseTemplate(fieldDefinition, field));
  const showUseTemplate = useMemo(() => fieldDefinition.field_type !== "text", [fieldDefinition.field_type]);
  const id = useId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fieldType = useMemo<any>(() => {
    if (useTemplate) {
      return "text";
    }
    return fieldDefinition.field_type;
  }, [fieldDefinition.field_type, useTemplate]);

  return (
    <>
      <Input
        label={fieldDefinition.name}
        tooltip={fieldDefinition.description || undefined}
        type={fieldType}
        {...(fieldDefinition.field_type === "model" ? { model: fieldDefinition.model } : {})}
        {...(fieldDefinition.field_type === "select" ? { options: fieldDefinition.options } : {})}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value={field as any}
        onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => setField(e.currentTarget.value)}
        onDelete={onDelete}
        extraButtons={
          showUseTemplate && (
            <>
              <input
                type="checkbox"
                class="btn-check"
                id={`btn-check-${id}`}
                checked={useTemplate}
                onInput={() => setUseTemplate((v) => !v)}
                autoComplete={"off"}
              />
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label
                class="btn btn-sm btn-outline-primary"
                for={`btn-check-${id}`}
                style="display: flex; align-items: center;"
              >
                <Tooltip text={getTemplateHelpTexts(fieldDefinition)}>
                  <i class="fas fa-code"></i>
                </Tooltip>
              </label>
            </>
          )
        }
      />
    </>
  );
};
