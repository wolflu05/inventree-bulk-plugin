import React, { JSX } from "preact/compat";
import { useId } from "preact/hooks";

import { ActionIcon, Box, Checkbox, Grid, Group, NumberInput, Select, Text, Textarea, TextInput } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-preact";

import { Tooltip } from "./Tooltip";

// import { customModelProcessors } from "../../utils/customModelProcessors";

interface DefaultInputProps {
  label: string;
  tooltip?: string;
  extraButtons?: React.ReactElement;
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
interface TextareaInputProps extends DefaultInputProps {
  type: "textarea";
  value: string;
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
  | TextareaInputProps
  | CheckboxInputProps
  | SelectInputProps
  | ArrayInputProps;

export function Input(props: InputProps) {
  return (
    <Grid align="center" gap={4}>
      <Grid.Col span={2}>
        <Tooltip text={props.tooltip}>
          <Text>{props.label}</Text>
        </Tooltip>
      </Grid.Col>
      <Grid.Col span={10}>
        <InputField {...props} />
      </Grid.Col>
    </Grid>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function InputField({ onInput, label, tooltip, ...props }: InputProps) {
  const id = useId();

  const extraFormGroup = (
    <>
      {props.extraButtons}
      {props.onDelete && (
        <ActionIcon variant="outline" color="red" size="input-xs" onClick={props.onDelete as () => void}>
          <IconTrash size={16} />
        </ActionIcon>
      )}
    </>
  );

  if (props.type === "number" || props.type === "float") {
    const { type, ...inputProps } = props;
    return (
      <Group align="flex-end" gap="xs">
        <NumberInput
          {...inputProps}
          onChange={(v) => onInput({ currentTarget: { value: v } })}
          allowDecimal={type === "float"}
          size="xs"
          flex={1}
        />
        {extraFormGroup}
      </Group>
    );
  }

  if (props.type === "text" || props.type === "email") {
    const { type, ...inputProps } = props;
    return (
      <Group align="flex-end" gap="xs">
        <TextInput type={type} {...inputProps} onChange={onInput} size="xs" flex={1} />
        {extraFormGroup}
      </Group>
    );
  }

  if (props.type === "checkbox" || props.type === "boolean") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type, value, ...inputProps } = props;
    return (
      <Group align="center" gap="xs">
        <Checkbox
          {...inputProps}
          checked={value}
          onChange={(e: JSX.TargetedEvent<HTMLInputElement, Event>) =>
            onInput?.({ currentTarget: { value: e.currentTarget.checked } })
          }
          flex={1}
        />
        {extraFormGroup}
      </Group>
    );
  }

  if (props.type === "textarea") {
    return (
      <Group align="flex-end" gap="xs">
        <Textarea {...props} onChange={onInput} flex={1} autosize minRows={3} />
        {extraFormGroup}
      </Group>
    );
  }

  if (props.type === "select") {
    const { options, ...inputProps } = props;
    return (
      <Group align="flex-end" gap="xs">
        <Select
          {...inputProps}
          size="xs"
          onChange={(v) => onInput({ currentTarget: { value: v } })}
          data={Object.entries(options).map(([k, v]) => ({ value: k, label: v }))}
          flex={1}
        />
        {extraFormGroup}
      </Group>
    );
  }

  if (props.type === "array") {
    const { onDelete, onAdd } = props;
    const marginRight = (i: number) => !props.onAdd && props.value.length === i + 1;

    return (
      <Group wrap="nowrap" gap={4}>
        {props.value.map((v: string, i: number) => (
          <Box w={"350px"} mr={marginRight(i) ? "31px" : ""}>
            <TextInput
              value={v}
              size="xs"
              onChange={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => onInput(i)(() => e.currentTarget.value)}
              rightSection={
                onDelete && (
                  <ActionIcon variant="outline" color="red" size="input-xs" onClick={onDelete(i)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                )
              }
            />
          </Box>
        ))}
        {onAdd && (
          <ActionIcon>
            <IconPlus size={16} onClick={() => onAdd()} />
          </ActionIcon>
        )}
      </Group>
    );
  }

  if (props.type === "model") {
    return <ModelInput label={label} extraFormGroup={extraFormGroup} id={id} {...props} />;
  }

  return <>"Not implemented"</>;
}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
interface ModelInputComponentProps extends ModelInputProps {
  extraFormGroup: React.ReactElement;
  id: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// const ModelInput = ({ model, extraFormGroup, id, onInput, value }: ModelInputComponentProps) => {
const ModelInput = ({ extraFormGroup, id }: ModelInputComponentProps) => {
  // console.log(model, id, value, onInput);
  // useEffect(() => {
  // @ts-ignore
  //   $(`#${id}`).select2({
  //     placeholder: "",
  //     allowClear: true,
  //     ajax: {
  //       url: model.api_url,
  //       dataType: "json",
  //       delay: 250,
  //       cache: true,
  //       data: (params: any) => {
  //         return {
  //           search: params.term?.trim(),
  //           offset: params.page ? (params.page - 1) * 25 : 0,
  //           limit: 25,
  //           ...model.limit_choices_to,
  //         };
  //       },
  //       processResults: (response: any) => {
  //         let data = [];
  //         let more = false;

  //         if ("count" in response && "results" in response) {
  //           // Response is paginated
  //           data = response.results;

  //           if (response.next) more = true;
  //         } else {
  //           // Non-paginated response
  //           data = response;
  //         }

  //         let results = data.map((x: any) => ({ id: x.pk, ...x }));
  //         if (customModelProcessors[model.model]) {
  //           results = results.map(customModelProcessors[model.model].mapFunction);
  //         }

  //         return {
  //           results,
  //           pagination: {
  //             more,
  //           },
  //         };
  //       },
  //     },
  //     templateResult: (item: any) => {
  //       let data = item;
  //       if (item.element?.instance) {
  //         data = item.element.instance;
  //       }

  //       if (customModelProcessors[model.model]) {
  //         return $(customModelProcessors[model.model].render(data));
  //       }

  //       if (!data.pk) {
  //         return $(`<span>Searching...</span>`);
  //       }
  //       const modelName = model.model.toLowerCase().split(".").at(-1);

  //       // @ts-ignore
  //       return $(`${renderModelData("", modelName, data, {})} <span>(${data.pk})</span>`);
  //     },
  //     templateSelection: (item: any) => {
  //       let data = item;
  //       if (item.element?.instance) {
  //         data = item.element.instance;
  //       }

  //       if (customModelProcessors[model.model]) {
  //         return $(customModelProcessors[model.model].render(data));
  //       }

  //       if (!data.pk) {
  //         return "";
  //       }
  //       const modelName = model.model.toLowerCase().split(".").at(-1);

  //       // @ts-ignore
  //       return $(`${renderModelData("", modelName, data, {})} <span>(${data.pk})</span>`);
  //     },
  //   });

  //   return () => {
  //     //@ts-ignore
  //     $(`#${id}`).select2("destroy");
  //   };
  // }, [id, model.api_url, model.limit_choices_to, model.model]);

  // useEffect(() => {
  //   $(`#${id}`).on("select2:select", (e) => {
  //     onInput?.(e);
  //   });
  //   $(`#${id}`).on("select2:clear", () => {
  //     onInput?.({ currentTarget: { value: "" } });
  //   });

  //   return () => {
  //     $(`#${id}`).off("select2:select");
  //     $(`#${id}`).off("select2:clear");
  //   };
  // }, [id, onInput]);

  // useEffect(() => {
  //   if (value && value !== $(`#${id}`).val()) {
  //     // current selected value and value from state are different
  //     const url = `${model.api_url}/${value}/`.replace("//", "/");

  //     const handleSuccess = (data: any) => {
  //       if (customModelProcessors[model.model]) {
  //         data = customModelProcessors[model.model].mapFunction(data);
  //       }
  //       const option = new Option("", data.id ?? data.pk, true, true);
  //       // @ts-ignore
  //       option.instance = data;
  //       $(`#${id}`).append(option).trigger("change");
  //       $(`#${id}`).trigger({
  //         type: "select2:select",
  //         // @ts-ignore
  //         params: {
  //           data,
  //         },
  //       });
  //     };

  //     const customProcessor = customModelProcessors[model.model];
  //     if (customProcessor?.getSingle) {
  //       return customProcessor.getSingle(value, handleSuccess);
  //     }

  //     // @ts-ignore
  //     inventreeGet(url, { ...model.limit_choices_to }, { success: handleSuccess });
  //   }
  // }, [id, model.api_url, model.limit_choices_to, model.model, value]);

  return (
    <Group align="flex-end">
      <select class="form-select form-select-sm" style={{ flex: 1 }} id={id}></select>
      {extraFormGroup}
    </Group>
  );
};
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
