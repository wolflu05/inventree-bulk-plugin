import { JSX } from "preact";
import { useCallback, useEffect, StateUpdater, Dispatch } from "preact/hooks";

import { Accordion, ActionIcon, Group, Paper, Stack, Title } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-preact";

import { GenerateKeysObject } from "./GenerateKeys";
import { Input } from "./ui/Input";
import { Tooltip } from "./ui/Tooltip";
import { defaultSchema } from "../utils/constants";
import { BulkDefinitionChild, BulkGenerateInfo, FieldType } from "../utils/types";

interface BulkDefinitionChildSchemaBuilderProps {
  childSchema: BulkDefinitionChild;
  setChildSchema: Dispatch<StateUpdater<BulkDefinitionChild>>;
  bulkGenerateInfo: BulkGenerateInfo;
  extendsKeys: Record<string, string>;
}

export function BulkDefinitionChildSchemaBuilder({
  childSchema,
  setChildSchema,
  bulkGenerateInfo,
  extendsKeys,
}: BulkDefinitionChildSchemaBuilderProps) {
  // initially populate childSchema with values
  useEffect(() => {
    if (Object.keys(childSchema.generate).length === 0 && Object.keys(bulkGenerateInfo.fields).length > 0) {
      setChildSchema((s) => ({
        ...s,
        generate: Object.fromEntries(
          Object.entries(bulkGenerateInfo.fields)
            .filter(([, { required }]) => !!required)
            .map(([k]) => [k, ""]),
        ),
      }));
    }
  }, [bulkGenerateInfo.fields, childSchema, setChildSchema]);

  // setValue callback for inputs, accepts key and event
  const setValue = useCallback(
    (key: string) => (e: JSX.TargetedEvent<HTMLInputElement, Event>) =>
      setChildSchema((s) => ({ ...s, [key]: e.currentTarget.value })),
    [setChildSchema],
  );

  // set a generated value by key and event
  const setGenerate: Dispatch<StateUpdater<Record<string, FieldType>>> = useCallback(
    (value) => setChildSchema((s) => ({ ...s, generate: typeof value === "function" ? value(s.generate) : value })),
    [setChildSchema],
  );

  // dimensions
  const setDimension: (key: "dimensions" | "count") => (i: number) => Dispatch<StateUpdater<string | null>> =
    useCallback(
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
  const setChildChildSchema: (i: number) => Dispatch<StateUpdater<BulkDefinitionChild>> = useCallback(
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

  return (
    <Stack>
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

      <Accordion variant="contained" chevronPosition="left">
        <Accordion.Item value="advanced">
          <Accordion.Control>
            <Title order={6}>Advanced Options</Title>
          </Accordion.Control>
          <Accordion.Panel>
            {bulkGenerateInfo.generate_type === "tree" && (
              <>
                <Input
                  label="Parent name match"
                  tooltip="First child that matches the parent name matcher will be chosen for generating the childs for a specific parent. Must evaluate to something that can be casted to a boolean."
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
              </>
            )}
            <Input
              label="Global context"
              tooltip="This template gets imported under the 'global' namespace to all generate fields. Use this to setup variables via the set keyword ('{% set hello = 'world' %}')which can be accessed as 'global.<x>' ('{{ global.hello }}')."
              type="textarea"
              value={childSchema.global_context || ""}
              onInput={setValue("global_context")}
            />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <Tooltip
        text={`You can use {{dim.x}} as a placeholder for the generated output of the dimension. For more info see the Readme.`}
      >
        <Title order={6}>Generate</Title>
      </Tooltip>
      <GenerateKeysObject
        fieldsDefinition={{
          name: "",
          description: null,
          required: true,
          field_type: "object",
          fields: bulkGenerateInfo.fields,
        }}
        fields={childSchema.generate}
        setFields={setGenerate}
      />

      {bulkGenerateInfo.generate_type === "tree" && (
        <>
          <Group>
            <Title order={6}>Childs</Title>
            <ActionIcon size="xs">
              <IconPlus size={16} onClick={addChild} />
            </ActionIcon>
          </Group>

          <Stack>
            {childSchema.childs?.map((child, i) => (
              <Paper withBorder p={10} ml={20}>
                <Group justify={"space-between"} align="flex-start" wrap="nowrap">
                  <Stack maw="calc(100% - 60px)" flex={1}>
                    <BulkDefinitionChildSchemaBuilder
                      childSchema={child}
                      setChildSchema={setChildChildSchema(i)}
                      bulkGenerateInfo={bulkGenerateInfo}
                      extendsKeys={extendsKeys}
                    />
                  </Stack>

                  <ActionIcon color="red" size="input-xs" variant="outline">
                    <IconTrash size={16} onClick={removeChild(i)} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}
