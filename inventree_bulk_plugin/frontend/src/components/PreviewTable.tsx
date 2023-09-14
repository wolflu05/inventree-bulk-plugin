import { useEffect, useId, useMemo } from "preact/hooks";

import { useNotifications } from "../contexts/Notification";
import { beautifySchema, escapeHtml, getCounter, getUsedGenerateKeys, toFlat } from "../utils";
import { URLS, fetchAPI } from "../utils/api";
import { customModelProcessors } from "../utils/customModelProcessors";
import { BulkGenerateInfo, FieldDefinition, FieldType, TemplateModel } from "../utils/types";

interface PreviewTableProps {
  template: TemplateModel;
  height?: number;
  parentId?: string;
  bulkGenerateInfo: BulkGenerateInfo;
}

export const PreviewTable = ({ template, height, parentId, bulkGenerateInfo }: PreviewTableProps) => {
  const { showNotification } = useNotifications();
  const id = useId();
  const tableId = useMemo(() => `preview-table-${id}`, [id]);

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
        return showNotification({ type: "danger", message: `An error occurred, ${json.error}` });
      }

      const data = toFlat(json, getCounter());

      showNotification({ type: "success", message: `Successfully parsed. This will generate ${data.length} items.` });

      const usedGenerateKeys = getUsedGenerateKeys(template.template);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const $table = $(`#${tableId}`) as any;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cache: Record<string, ((field: any) => void)[]> = {};

      const format = (fieldDefinition: FieldDefinition, value: FieldType, cellId: string): string => {
        if (value === undefined) return "";

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

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const renderOne = (f: any) => {
                if (!f.pk) {
                  return "";
                }
                const modelName = fieldDefinition.model.model.toLowerCase().split(".").at(-1);

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                return `${renderModelData("", modelName, f, {})} <span>(${f.pk})</span>`;
              };

              if (fieldDefinition.allow_multiple && Array.isArray(field)) {
                return `<li>${field.map(renderOne).join("</li><li>")}</li>`;
              }
              return renderOne(field);
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
            const cacheKey = `~get-api-${JSON.stringify(value)}`;
            let urlPath = `${value}/`;
            let filters = { ...fieldDefinition.model.limit_choices_to };

            // use json filters
            if (Number.isNaN(parseInt(value as string, 10))) {
              urlPath = "";
              filters = { ...JSON.parse(value as string), ...filters };

              // name is mostly not there, use search instead
              if ("name" in filters) filters.search = filters.name;
            }

            const url = `${fieldDefinition.model.api_url}/${urlPath}`.replace("//", "/");

            if (!cache[cacheKey]) {
              cache[cacheKey] = [];
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              inventreeGet(
                url,
                { ...filters },
                {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  success: (item: any) => {
                    cache[cacheKey].forEach((handler) => handler(item));
                  },
                },
              );
            }
            cache[cacheKey].push(handleSuccess);
          }

          return `<span id=${cellId} class="placeholder placeholder-glow col-4">${value}</span>`;
        }
        if (fieldDefinition.field_type === "select") {
          return escapeHtml(fieldDefinition.options[value as string] ?? `${value}`);
        }
        if (fieldDefinition.field_type === "list" && Array.isArray(value)) {
          return `<ul>${value
            .map((r, i) => `<li>${format(fieldDefinition.items_type, r, `${cellId}-${i}`)}</li>`)
            .join("")}</ul>`;
        }
        if (fieldDefinition.field_type === "object" && typeof value === "object") {
          return `<ul>${Object.entries(value)
            .map(
              ([k, r], i) =>
                `<li>${escapeHtml(fieldDefinition.fields[k].name ?? k)}: ${format(
                  fieldDefinition.fields[k],
                  r,
                  `${cellId}-${i}`,
                )}</li>`,
            )
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
          ...Object.entries(bulkGenerateInfo.fields)
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
  }, [bulkGenerateInfo.fields, height, id, parentId, showNotification, tableId, template]);

  return (
    <div class="mt-3">
      <table id={tableId} style={{ whiteSpace: "nowrap" }}></table>
    </div>
  );
};
