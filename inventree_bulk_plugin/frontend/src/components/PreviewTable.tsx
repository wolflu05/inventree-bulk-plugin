import { useEffect, useId, useMemo } from "preact/hooks";

import { useBulkGenerateInfo } from "../contexts/BulkCreateInfo";
import { useNotifications } from "../contexts/Notification";
import { beautifySchema, escapeHtml, getCounter, getUsedGenerateKeys, toFlat } from "../utils";
import { URLS, fetchAPI } from "../utils/api";
import { customModelProcessors } from "../utils/customModelProcessors";
import { FieldDefinition, FieldType, TemplateModel } from "../utils/types";

interface PreviewTableProps {
  template: TemplateModel;
  height?: number;
  parentId?: string;
}

export const PreviewTable = ({ template, height, parentId }: PreviewTableProps) => {
  const { showNotification } = useNotifications();
  const id = useId();
  const tableId = useMemo(() => `preview-table-${id}`, [id]);

  const { bulkGenerateInfoDict } = useBulkGenerateInfo();

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cache: Record<string, ((field: any) => void)[]> = {};

      const format = (fieldDefinition: FieldDefinition, value: FieldType, cellId: string): string => {
        if (fieldDefinition.field_type === "model") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const handleSuccess = (field: any) => {
            const fetchedValue = (() => {
              if (customModelProcessors[fieldDefinition.model.model]) {
                field = customModelProcessors[fieldDefinition.model.model].mapFunction(field);
              }
              if (field.element?.instance) {
                field = field.element.instance;
              }

              if (customModelProcessors[fieldDefinition.model.model]) {
                return customModelProcessors[fieldDefinition.model.model].render(field);
              }

              if (!field.pk) {
                return "";
              }
              const modelName = fieldDefinition.model.model.toLowerCase().split(".").at(-1);

              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              return `${renderModelData("", modelName, field, {})} <span>(${field.pk})</span>`;
            })();

            const cell = document.getElementById(cellId);
            if (cell) {
              cell.innerHTML = fetchedValue;
              cell.classList.remove("placeholder", "placeholder-glow", "col-4");
              $table.bootstrapTable("resetView");
            }
          };

          const customProcessor = customModelProcessors[fieldDefinition.model.model];
          if (customProcessor?.getSingle) {
            const cacheKey = `~get-single-${value}`;
            if (!cache[cacheKey]) {
              cache[cacheKey] = [];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              customProcessor.getSingle(value, (d: any) => cache[cacheKey].forEach((handler) => handler(d)));
            }
            cache[cacheKey].push(handleSuccess);
          } else {
            const url = `${fieldDefinition.model.api_url}/${value}/`.replace("//", "/");

            if (!cache[url]) {
              cache[url] = [];
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              inventreeGet(
                url,
                { ...fieldDefinition.model.limit_choices_to },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { success: (d: any) => cache[url].forEach((handler) => handler(d)) },
              );
            }
            cache[url].push(handleSuccess);
          }

          return `<span id=${cellId} class="placeholder placeholder-glow col-4">${value}</span>`;
        }
        if (fieldDefinition.field_type === "list" && Array.isArray(value)) {
          return `<ul>${value
            .map((r, i) => `<li>${format(fieldDefinition.items_type, r, `${cellId}-${i}`)}</li>`)
            .join("")}</ul>`;
        }
        if (fieldDefinition.field_type === "object" && typeof value === "object") {
          return `<ul>${Object.entries(value)
            .map(([k, r], i) => `<li>${escapeHtml(k)}: ${format(fieldDefinition.fields[k], r, `${cellId}-${i}`)}</li>`)
            .join("")}</ul>`;
        }
        return escapeHtml(`${value}`);
      };

      $table.bootstrapTable("destroy");
      $table.bootstrapTable({
        data,
        idField: "id",
        height,
        columns: [
          ...Object.entries(bulkGenerateInfoDict[template.template_type].fields)
            .filter(([key]) => usedGenerateKeys.includes(key))
            .map(([key, f]) => ({
              field: key,
              title: f.name,
              formatter: (value: FieldType, _row: Record<string, FieldType>, index: number) =>
                format(f, value, `table-${id}-field-${index}`),
            })),
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
  }, [bulkGenerateInfoDict, height, id, parentId, showNotification, tableId, template]);

  return (
    <div class="mt-3">
      <table id={tableId} style={{ whiteSpace: "nowrap" }}></table>
    </div>
  );
};
