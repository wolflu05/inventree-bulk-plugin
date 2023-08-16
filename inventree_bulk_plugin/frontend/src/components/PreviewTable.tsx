import { useEffect, useId, useMemo } from "preact/hooks";

import { useGenerateKeysForTemplateType } from "../contexts/GenerateKeys";
import { useNotifications } from "../contexts/Notification";
import { URLS, beautifySchema, fetchAPI, getCounter, getUsedGenerateKeys, toFlat } from "../utils";
import { TemplateModel } from "../utils/types";

interface PreviewTableProps {
  template: TemplateModel;
  height?: number;
  parentId?: string;
}

export const PreviewTable = ({ template, height, parentId }: PreviewTableProps) => {
  const { showNotification } = useNotifications();
  const id = useId();
  const tableId = useMemo(() => `preview-table-${id}`, [id]);

  const generateKeys = useGenerateKeysForTemplateType(template.template_type);

  useEffect(() => {
    (async () => {
      const res = await fetchAPI(URLS.bulkcreate({ parentId, create: false }), {
        method: "POST",
        body: JSON.stringify({
          ...template,
          template: JSON.stringify(beautifySchema(template.template)),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        return showNotification({ type: "danger", message: `An error occourd, ${json.error}` });
      }

      const data = toFlat(json, getCounter());

      showNotification({ type: "success", message: `Successfully parsed. This will generate ${data.length} items.` });

      const usedGenerateKeys = getUsedGenerateKeys(template.template);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const $table = $(`#${tableId}`) as any;
      $table.bootstrapTable("destroy");
      $table.bootstrapTable({
        data,
        idField: "id",
        height,
        columns: [
          ...Object.entries(generateKeys)
            .filter(([key]) => usedGenerateKeys.includes(key))
            .map(([key, { name }]) => ({ field: key, title: name })),
          { field: "path", title: "Path" },
        ],
        treeShowField: "name",
        parentIdField: "pid",
        onPostBody() {
          const columns = $table.bootstrapTable("getOptions").columns;

          if (columns && columns[0][1].visible) {
            $table.treegrid({
              treeColumn: 0,
              onChange() {
                $table.bootstrapTable("resetView");
              },
            });
          }
        },
        rowStyle: () => ({
          css: {
            padding: "2px 0.5rem",
          },
        }),
      });
    })();
  }, [generateKeys, height, parentId, showNotification, tableId, template]);

  return (
    <div class="mt-3">
      <table id={tableId}></table>
    </div>
  );
};
