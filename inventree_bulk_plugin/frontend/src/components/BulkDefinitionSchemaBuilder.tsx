import { JSX } from "preact";
import { useState, useCallback, useEffect, useMemo, useRef, StateUpdater, Dispatch } from "preact/hooks";

import { Accordion, ActionIcon, Group, Paper, Stack, TextInput, Title } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-preact";

import { BulkDefinitionChildSchemaBuilder } from "./BulkDefinitionChildSchemaBuilder";
import { Input } from "./ui/Input";
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

  return (
    <Accordion variant="contained" multiple defaultValue={["output"]}>
      <Accordion.Item value="input">
        <Accordion.Control>
          <Title order={5}>Input</Title>
        </Accordion.Control>
        <Accordion.Panel>
          {input.map((inp, i) => (
            <Group align="flex-end">
              <TextInput value={inp.key} onInput={setInputKey(i, "key")} label="Key" flex={1} size="xs" />
              <TextInput value={inp.value} onInput={setInputKey(i, "value")} label="Value" flex={1} size="xs" />

              <ActionIcon color="red" size="input-xs" variant="outline">
                <IconTrash size={16} onClick={removeInput(i)} />
              </ActionIcon>
            </Group>
          ))}

          <ActionIcon size="input-xs" mt={10}>
            <IconPlus size={16} onClick={addInput} />
          </ActionIcon>
        </Accordion.Panel>
      </Accordion.Item>

      {bulkGenerateInfo.generate_type === "tree" && (
        <Accordion.Item value="templates">
          <Accordion.Control>
            <Title order={5}>Templates</Title>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack>
              {schema.templates.map((template, i) => (
                <Paper p={10}>
                  <Group justify={"space-between"} align="flex-start" wrap="nowrap">
                    <Stack>
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
                    </Stack>

                    <ActionIcon color="red" size="input-xs" variant="outline">
                      <IconTrash size={16} onClick={removeTemplate(i)} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))}

              <ActionIcon size="input-xs">
                <IconPlus size={16} onClick={addTemplate} />
              </ActionIcon>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      )}

      <Accordion.Item value="output">
        <Accordion.Control>
          <Title order={5}>Output</Title>
        </Accordion.Control>
        <Accordion.Panel>
          <BulkDefinitionChildSchemaBuilder
            childSchema={schema.output}
            setChildSchema={setChildSchema}
            bulkGenerateInfo={bulkGenerateInfo}
            extendsKeys={extendsKeys}
          />
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
