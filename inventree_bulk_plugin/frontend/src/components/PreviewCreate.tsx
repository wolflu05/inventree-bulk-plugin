import { JSX } from "preact";
import { StateUpdater, useCallback, useEffect, useState } from "preact/hooks";

import { Input } from "./Input";
import { PreviewTable } from "./PreviewTable";
import { useNotifications } from "../contexts/Notification";
import { beautifySchema } from "../utils";
import { URLS, fetchAPI } from "../utils/api";
import { TemplateModel } from "../utils/types";

interface PreviewCreateProps {
  template: TemplateModel;
  parentId?: string;
  attachPreviewHandler?: (previewHandler: () => void) => void;
  attachCreateHandler?: (createHandler: () => void) => void;
  handleDoneCreate?: (ok: boolean) => void;
  setIsBulkCreateLoading: StateUpdater<boolean>;
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
  const [initial, setIntial] = useState(true);

  const { showNotification } = useNotifications();

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

    const res = await fetchAPI(URLS.bulkcreate({ parentId, create: true }), {
      method: "POST",
      body: JSON.stringify({
        ...final,
        template: JSON.stringify(beautifySchema(final.template)),
      }),
    });
    const json = await res.json();

    setIsBulkCreateLoading(false);

    if (!res.ok) {
      handleDoneCreate?.(false);
      return showNotification({ type: "danger", message: `An error occourd, ${json.error}` });
    }

    showNotification({ type: "success", message: `Successfully bulk created ${json.length} ${final.template_type}s.` });
    handleDoneCreate?.(true);
  }, [handleDoneCreate, inputs, parentId, setIsBulkCreateLoading, showNotification, template]);

  const previewHandler = useCallback(() => {
    const final = structuredClone(getTemplateWithInputs(template, inputs));
    setPreviewTemplate(final);
    setIntial(false);
  }, [inputs, template]);

  const createHandler = useCallback(() => {
    handleBulkCreate();
  }, [handleBulkCreate]);

  useEffect(() => attachPreviewHandler?.(previewHandler), [attachPreviewHandler, previewHandler]);
  useEffect(() => attachCreateHandler?.(createHandler), [attachCreateHandler, createHandler]);

  return (
    <div>
      <h5>Inputs</h5>
      <div>
        {inputs.map(({ key, value }) => (
          <Input key={key} type="text" label={key} value={value} onInput={setInput(key)} />
        ))}
      </div>

      {previewTemplate && (
        <>
          <h5>Preview</h5>
          <div class={initial ? "mb-4" : ""}>
            <PreviewTable template={previewTemplate} height={250} parentId={parentId} />
          </div>
        </>
      )}
    </div>
  );
};
