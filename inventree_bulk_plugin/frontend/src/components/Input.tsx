import { ComponentChildren, JSX } from "preact";
import { useEffect, useId } from "preact/hooks";

import { Tooltip } from "./Tooltip";

interface DefaultInputProps {
  label: string;
  tooltip?: string;
  extraButtons?: ComponentChildren;
  onDelete?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
interface TextInputProps extends DefaultInputProps {
  type: "text" | "email" | "number" | "float";
  value: string;
}
interface ModelInputProps extends DefaultInputProps {
  type: "model";
  value: string;
  model: { model: string; limit_choices_to: Record<string, string>; api_url: string };
}
interface NumberInputProps extends DefaultInputProps {
  type: "number";
  value: number;
}
interface CheckboxInputProps extends DefaultInputProps {
  type: "checkbox" | "boolean";
  value: boolean;
}
interface SelectInputProps extends DefaultInputProps {
  type: "select";
  value: string;
  options: Record<string, string>;
}
interface ArrayInputProps extends Omit<DefaultInputProps, "onDelete"> {
  type: "array";
  value: string[];
  onDelete?: (i: number) => () => void;
  onAdd?: () => void;
}
type InputProps =
  | TextInputProps
  | ModelInputProps
  | NumberInputProps
  | CheckboxInputProps
  | SelectInputProps
  | ArrayInputProps;

export function Input(props: InputProps) {
  const id = useId();

  const extraFormGroup = (
    <>
      {props.extraButtons}
      {props.onDelete && (
        <button class="btn btn-outline-danger btn-sm" onClick={props.onDelete as () => void}>
          <i class="fa fa-trash"></i>
        </button>
      )}
    </>
  );

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
        if (props.type === "text" || props.type === "number" || props.type === "email" || props.type === "float") {
          const { type, ...inputProps } = props;
          return (
            <div class="col-sm-10 input-group" style="flex: 1;">
              <input
                type={type === "float" ? "number" : type}
                class="form-control form-control-sm"
                id={`input-${id}`}
                {...(type === "float" ? { step: "any" } : {})}
                {...inputProps}
              />
              {extraFormGroup}
            </div>
          );
        } else if (props.type === "model") {
          return <ModelInput extraFormGroup={extraFormGroup} id={id} {...props} />;
        } else if (props.type === "checkbox" || props.type === "boolean") {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { type, value, ...inputProps } = props;
          return (
            <div class="col-sm-10 input-group" style="flex: 1;">
              <label class="input-group-text" style="flex: 1;" for={`input-${id}`}>
                <input
                  type="checkbox"
                  class="form-check-input form-check-sm"
                  id={`input-${id}`}
                  checked={value}
                  {...inputProps}
                  onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) =>
                    inputProps.onInput?.({ currentTarget: { value: e.currentTarget.checked } })
                  }
                />
              </label>
              {extraFormGroup}
            </div>
          );
        } else if (props.type === "select") {
          return (
            <div class="col-sm-10 input-group" style="flex: 1;">
              <select class="form-select form-select-sm" id={`input-${id}`} {...props}>
                {Object.entries(props.options).map(([k, v]) => (
                  <option value={k}>{v}</option>
                ))}
              </select>
              {extraFormGroup}
            </div>
          );
        } else if (props.type === "array") {
          const { onDelete, onAdd } = props;
          const marginRight = (i: number) => !props.onAdd && props.value.length === i + 1;

          return (
            <div class="col-sm-10">
              <div class="d-flex flex-row flex-nowrap" style="gap: 4px">
                {props.value.map((v: string, i: number) => (
                  <div class="input-group" style={`max-width: 350px; ${marginRight(i) ? "margin-right: 31px;" : ""}`}>
                    <input
                      type="text"
                      class="form-control form-control-sm"
                      id={`input-${id}-${i}`}
                      value={v}
                      onInput={(e) => props.onInput(i)(() => e.currentTarget.value)}
                    />
                    {onDelete && (
                      <button class="btn btn-outline-danger btn-sm" onClick={onDelete(i)}>
                        <i class="fa fa-trash"></i>
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

interface ModelInputComponentProps extends ModelInputProps {
  extraFormGroup: ComponentChildren;
  id: string;
}

const ModelInput = ({ model, extraFormGroup, id, onInput, value }: ModelInputComponentProps) => {
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
  useEffect(() => {
    // @ts-ignore
    $(`#${id}`).select2({
      placeholder: "",
      allowClear: true,
      ajax: {
        url: model.api_url,
        dataType: "json",
        delay: 250,
        cache: true,
        data: (params: any) => {
          return {
            search: params.term?.trim(),
            offset: params.page ? (params.page - 1) * 25 : 0,
            limit: 25,
            ...model.limit_choices_to,
          };
        },
        processResults: (response: any) => {
          let data = [];
          let more = false;

          if ("count" in response && "results" in response) {
            // Response is paginated
            data = response.results;

            if (response.next) more = true;
          } else {
            // Non-paginated response
            data = response;
          }

          return {
            results: data.map((x: any) => ({ id: x.pk, ...x })),
            pagination: {
              more,
            },
          };
        },
      },
      templateResult: (item: any) => {
        let data = item;
        if (item.element?.instance) {
          data = item.element.instance;
        }

        if (!data.pk) {
          return $(`<span>Searching...</span>`);
        }
        const modelName = model.model.toLowerCase().split(".").at(-1);

        // @ts-ignore
        return $(`${renderModelData("", modelName, data, {})} <span>(${data.pk})</span>`);
      },
      templateSelection: (item: any) => {
        let data = item;
        if (item.element?.instance) {
          data = item.element.instance;
        }

        if (!data.pk) {
          return "";
        }
        const modelName = model.model.toLowerCase().split(".").at(-1);

        // @ts-ignore
        return $(`${renderModelData("", modelName, data, {})} <span>(${data.pk})</span>`);
      },
    });

    return () => {
      //@ts-ignore
      $(`#${id}`).select2("destroy");
    };
  }, [id, model.api_url, model.limit_choices_to, model.model]);

  useEffect(() => {
    $(`#${id}`).on("select2:select", (e) => {
      onInput?.(e);
    });
    $(`#${id}`).on("select2:clear", () => {
      onInput?.({ currentTarget: { value: "" } });
    });

    return () => {
      $(`#${id}`).off("select2:select");
      $(`#${id}`).off("select2:clear");
    };
  }, [id, onInput]);

  useEffect(() => {
    if (value && value !== $(`#${id}`).val()) {
      // current selected value and value from state are different
      const url = `${model.api_url}/${value}/`.replace("//", "/");

      // @ts-ignore
      inventreeGet(
        url,
        { ...model.limit_choices_to },
        {
          success: (data: any) => {
            const option = new Option("", data.pk, true, true);
            // @ts-ignore
            option.instance = data;
            $(`#${id}`).append(option).trigger("change");
            $(`#${id}`).trigger({
              type: "select2:select",
              // @ts-ignore
              params: {
                data,
              },
            });
          },
        },
      );
    }
  }, [id, model.api_url, model.limit_choices_to, value]);
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */

  return (
    <div class="col-sm-10 input-group" style="flex: 1;">
      <select class="form-select form-select-sm" id={id}></select>
      {extraFormGroup}
    </div>
  );
};
