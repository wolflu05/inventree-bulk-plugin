import React, { JSX } from "preact/compat";

import { ActionIcon, Box, Checkbox, Grid, Group, NumberInput, Select, Text, Textarea, TextInput } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-preact";

import { Tooltip } from "./Tooltip";
import { RelatedModelField } from "../inventree/RelatedModelField";

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
    return (
      <Group align="flex-end">
        <RelatedModelField
          value={props.value as unknown as number}
          api_url={props.model.api_url}
          filters={props.model.limit_choices_to}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model={props.model.model.split(".")[1].toLowerCase() as any}
          onChange={(newVal) => onInput({ currentTarget: { value: newVal } })}
        />
        {extraFormGroup}
      </Group>
    );
  }

  return <>"Not implemented"</>;
}
