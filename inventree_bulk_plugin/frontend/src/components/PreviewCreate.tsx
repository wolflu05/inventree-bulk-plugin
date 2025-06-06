import { JSX } from "preact";
import { Dispatch, StateUpdater, useCallback, useEffect, useState } from "preact/hooks";

import { Space, Stack, Title } from "@mantine/core";
import { showNotification } from "@mantine/notifications";

import { PreviewTable } from "./PreviewTable";
import { Input } from "./ui/Input";
import { useApi } from "../contexts/InvenTreeContext";
import { beautifySchema } from "../utils";
import { AxiosError, URLS } from "../utils/api";
import { BulkGenerateInfo, TemplateModel } from "../utils/types";

interface PreviewCreateProps {
  template: TemplateModel;
  parentId?: string;
  attachPreviewHandler?: (previewHandler: () => void) => void;
  attachCreateHandler?: (createHandler: () => void) => void;
  handleDoneCreate?: (ok: boolean) => void;
  setIsBulkCreateLoading: Dispatch<StateUpdater<boolean>>;
}

interface InputType {
  key: string;
  value: string;
}

const getTemplateWithInputs = (template: TemplateModel, inputs: InputType[]) => {
  return {
    ...template,
    template: {
      ...template.template,
      input: Object.fromEntries(inputs.map(({ key, value }) => [key, value])),
    },
  };
};

export const PreviewCreate = ({
  template,
  parentId,
  attachPreviewHandler,
  attachCreateHandler,
  handleDoneCreate,
  setIsBulkCreateLoading,
}: PreviewCreateProps) => {
  const [previewTemplate, setPreviewTemplate] = useState<TemplateModel>();
  const [inputs, setInputs] = useState<InputType[]>([]);
  const [initial, setInitial] = useState(true);
  const [bulkGenerateInfo, setBulkGenerateInfo] = useState<BulkGenerateInfo>();

  const api = useApi();

  useEffect(() => {
    if (!template?.template_type || !parentId) return;

    api
      .get(URLS.bulkcreate({ parentId, templateType: template.template_type }))
      .then((res) => {
        setBulkGenerateInfo(res.data);
      })
      .catch((err) => {
        showNotification({ color: "red", message: `Failed to load bulk generate info,\n${err.response.statusText}` });
      });
  }, [api, parentId, template.template_type]);

  useEffect(() => {
    setInputs(Object.entries(template.template.input).map(([k, v]) => ({ key: k, value: v })));
  }, [template.template.input]);

  const setInput = useCallback(
    (key: string) => (e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
      setInputs((i) => i.map(({ key: k, value }) => ({ key: k, value: key === k ? e.currentTarget.value : value })));
    },
    [],
  );

  const handleBulkCreate = useCallback(async () => {
    setIsBulkCreateLoading(true);

    const final = getTemplateWithInputs(template, inputs);

    let res;
    try {
      res = await api.post(URLS.bulkcreate({ parentId, create: true }), {
        ...final,
        template: JSON.stringify(beautifySchema(final.template)),
      });
    } catch (err) {
      handleDoneCreate?.(false);
      showNotification({
        color: "red",
        message: `An error occurred, ${(err as AxiosError).response?.data?.error}`,
      });
      return;
    } finally {
      setIsBulkCreateLoading(false);
    }

    showNotification({
      color: "green",
      message: `Successfully bulk created ${res.data.length} ${bulkGenerateInfo?.name}s.`,
    });
    handleDoneCreate?.(true);
  }, [api, bulkGenerateInfo?.name, handleDoneCreate, inputs, parentId, setIsBulkCreateLoading, template]);

  const previewHandler = useCallback(() => {
    const final = structuredClone(getTemplateWithInputs(template, inputs));
    setPreviewTemplate(final);
    setInitial(false);
  }, [inputs, template]);

  const createHandler = useCallback(() => {
    handleBulkCreate();
  }, [handleBulkCreate]);

  useEffect(() => attachPreviewHandler?.(previewHandler), [attachPreviewHandler, previewHandler]);
  useEffect(() => attachCreateHandler?.(createHandler), [attachCreateHandler, createHandler]);

  return (
    <Stack gap="xs">
      <Title order={4}>Inputs</Title>

      <Stack gap="xs">
        {inputs.map(({ key, value }) => (
          <Input key={key} type="text" label={key} value={value} onInput={setInput(key)} />
        ))}
      </Stack>

      {previewTemplate && bulkGenerateInfo && (
        <>
          <Title order={5}>Preview</Title>
          {initial && <Space h="15px" />}
          <PreviewTable
            template={previewTemplate}
            height={350}
            parentId={parentId}
            bulkGenerateInfo={bulkGenerateInfo}
          />
        </>
      )}
    </Stack>
  );
};
