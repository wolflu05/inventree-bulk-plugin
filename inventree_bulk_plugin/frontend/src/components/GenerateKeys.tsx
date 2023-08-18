import { JSX } from "preact";
import { StateUpdater, useCallback, useMemo, useState } from "preact/hooks";

import { Input } from "./Input";
import { FieldDefinition, FieldDefinitionList, FieldDefinitionObject, FieldType } from "../utils/types";

const getDefaultValue = (fieldDefinition: FieldDefinition): FieldType => {
  // use potential default value that is available via API
  if (fieldDefinition.default) return fieldDefinition.default;

  if (fieldDefinition.field_type === "list") {
    return [getDefaultValue(fieldDefinition.items_type)];
  } else if (fieldDefinition.field_type == "object") {
    return Object.fromEntries(
      Object.entries(fieldDefinition.fields)
        .filter(([, f]) => f.required)
        .map(([k, f]) => [k, getDefaultValue(f)]),
    );
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

  return (
    <Input
      label={fieldDefinition.name}
      tooltip={fieldDefinition.description || undefined}
      type="text"
      value={field as string}
      onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => setField(e.currentTarget.value)}
      onDelete={onDelete}
    />
  );
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
    <div class="mb-2">
      {fieldsDefinition.name && <h6>{fieldsDefinition.name}</h6>}
      <div class="card p-2 ms-3">
        {fields.map((field, i) => (
          <GenerateKeys
            fieldDefinition={itemsFieldsDefinition}
            field={field}
            setField={setField(i)}
            onDelete={handleDeleteGenerateKey(i)}
          />
        ))}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button class="btn btn-small btn-outline-primary" onClick={handleAddGenerateKey}>
            Add {fieldsDefinition.name}
          </button>
          {onDelete && (
            <button class="btn btn-small btn-outline-danger pe-2 ps-2" onClick={onDelete}>
              X
            </button>
          )}
        </div>
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
        <div class={`col ${showCard ? "p-2" : ""}`} style={{ marginBottom: "-15px" }}>
          {fieldsDefinition.name && <h6>{fieldsDefinition.name}</h6>}
          {Object.entries(subFieldsDefinition)
            .filter(([key]) => fields[key] !== undefined)
            .map(([key, fieldDefinition]) => {
              const value = fields[key];

              return (
                <GenerateKeys
                  fieldDefinition={fieldDefinition}
                  field={value}
                  setField={setGenerateValue(key)}
                  onDelete={fieldDefinition.required ? undefined : handleDeleteGenerateKey(key)}
                />
              );
            })}
          {remainingGenerateKeys.length > 0 && (
            <div style="display: flex; max-width: 200px; margin-bottom: 15px;">
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
            <button onClick={onDelete} class="btn btn-outline-danger">
              X
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
