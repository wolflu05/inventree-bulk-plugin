import { useId } from "preact/hooks";

import { Tooltip } from "./Tooltip";

interface DefaultInputProps {
  label: string;
  tooltip?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
interface TextInputProps extends DefaultInputProps {
  type: "text" | "email" | "number";
  value: string;
  onDelete?: () => void;
}
interface NumberInputProps extends DefaultInputProps {
  type: "number";
  value: number;
  onDelete?: () => void;
}
interface CheckboxInputProps extends DefaultInputProps {
  type: "checkbox";
  value: boolean;
}
interface SelectInputProps extends DefaultInputProps {
  type: "select";
  value: string;
  options: Record<string, string>;
}
interface ArrayInputProps extends DefaultInputProps {
  type: "array";
  value: string[];
  onDelete?: (i: number) => () => void;
  onAdd?: () => void;
}
type InputProps = TextInputProps | NumberInputProps | CheckboxInputProps | SelectInputProps | ArrayInputProps;

export function Input(props: InputProps) {
  const id = useId();

  return (
    <div class="form-group row">
      <div class="col-sm-2">
        <Tooltip text={props.tooltip}>
          <label for={`input-${id}`} class="col-form-label col-form-label-sm">
            {props.label}
          </label>
        </Tooltip>
      </div>
      {(() => {
        if (props.type === "text" || props.type === "number" || props.type === "email") {
          const { type, ...inputProps } = props;
          return (
            <div class="col-sm-10 input-group" style="flex: 1;">
              <input type={type} class="form-control form-control-sm" id={`input-${id}`} {...inputProps} />
              {props.onDelete && (
                <button class="btn btn-outline-danger btn-sm" onClick={props.onDelete}>
                  X
                </button>
              )}
            </div>
          );
        } else if (props.type === "checkbox") {
          const { type, value, ...inputProps } = props;
          return (
            <div class="col-sm-10">
              <input
                type={type}
                class="form-check-input form-check-sm"
                id={`input-${id}`}
                checked={value}
                {...inputProps}
              />
            </div>
          );
        } else if (props.type === "select") {
          return (
            <div class="col-sm-10">
              <select class="form-select form-select-sm" id={`input-${id}`} {...props}>
                {Object.entries(props.options).map(([k, v]) => (
                  <option value={k}>{v}</option>
                ))}
              </select>
            </div>
          );
        } else if (props.type === "array") {
          const { onDelete, onAdd } = props;
          return (
            <div class="col-sm-10">
              <div class="d-flex flex-row flex-nowrap" style="gap: 4px">
                {props.value.map((v: string, i: number) => (
                  <div
                    class="input-group"
                    style={`max-width: 350px; ${
                      !props.onAdd && props.value.length === i + 1 ? "margin-right: 31px;" : ""
                    }`}
                  >
                    <input
                      type="text"
                      class="form-control form-control-sm"
                      id={`input-${id}-${i}`}
                      value={v}
                      onInput={(e) => props.onInput(i)(() => e.currentTarget.value)}
                    />
                    {onDelete && (
                      <button class="btn btn-outline-danger btn-sm" onClick={onDelete(i)}>
                        X
                      </button>
                    )}
                  </div>
                ))}
                {onAdd && (
                  <button class="btn btn-outline-primary btn-sm" onClick={() => onAdd()}>
                    +
                  </button>
                )}
              </div>
            </div>
          );
        }

        return "Not implemented";
      })()}
    </div>
  );
}
