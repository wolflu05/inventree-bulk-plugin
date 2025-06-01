import { useEffect, useId, useMemo } from "preact/hooks";

import { showNotification } from "@mantine/notifications";

import { useApi } from "../contexts/InvenTreeContext";
import { beautifySchema, escapeHtml, getCounter, getUsedGenerateKeys, toFlat } from "../utils";
import { AxiosError, URLS } from "../utils/api";
import { customModelProcessors } from "../utils/customModelProcessors";
import { BulkGenerateInfo, FieldDefinition, FieldType, TemplateModel } from "../utils/types";

const MODEL_LIMIT = 10;
interface PreviewTableProps {
  template: TemplateModel;
  height?: number;
  parentId?: string;
  bulkGenerateInfo: BulkGenerateInfo;
}

export const PreviewTable = ({ template, height, parentId, bulkGenerateInfo }: PreviewTableProps) => {
  const id = useId();
  const tableId = useMemo(() => `preview-table-${id}`, [id]);
  const api = useApi();

  useEffect(() => {
    (async () => {
      let res;
      try {
        res = await api.post(URLS.bulkcreate({ parentId, create: false }), {
          ...template,
          template: JSON.stringify(beautifySchema(template.template)),
        });
      } catch (err) {
        showNotification({ color: "red", message: `An error occurred, ${(err as AxiosError).response?.data?.error}` });
        return;
      }

      const data = toFlat(res.data, getCounter());

      showNotification({ color: "green", message: `Successfully parsed. This will generate ${data.length} items.` });

      const usedGenerateKeys = getUsedGenerateKeys(template.template);

      // TODO
      document.getElementById(tableId)!.innerHTML = data
        .map((d) => `<tr><td>${d.id}  - ${d.path} - ${d.pid}</td></tr>`)
        .join("");

      return;

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

              const count = field.count;
              if (fieldDefinition.allow_multiple && field.results) field = field.results;
              if (fieldDefinition.allow_multiple && Array.isArray(field)) {
                // render ... if there are more fields available
                let hasMore = false;
                let extraText = "";
                if (count === undefined) {
                  hasMore = count > field.length;
                  extraText = `${count - field.length} more elements`;
                } else if (field.length >= MODEL_LIMIT) {
                  field.pop(); // remove one element so that the ... is real
                  hasMore = true;
                  extraText = `at least one more element`;
                }

                const renderedElements = `<li>${field.map(renderOne).join("</li><li>")}</li>`;
                return `${renderedElements}${hasMore ? `<li>... ${extraText}</li>` : ""}`;
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
            let urlPath = `${value}/`;
            let filters = { ...fieldDefinition.model.limit_choices_to };

            // use json filters
            if (Number.isNaN(parseInt(value as string, 10))) {
              urlPath = "";
              filters = { ...JSON.parse(value as string), ...filters };

              // name is mostly not there, use search instead
              if ("name" in filters) filters.search = filters.name;
            }

            const url = `${fieldDefinition.model.api_url}/${urlPath}?limit=${MODEL_LIMIT}`.replace("//", "/");
            const cacheKey = `~get-api-${url}-${JSON.stringify(value)}`;

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
              formatter: (value: FieldType, _row: Record<string, FieldType>, index: number, cellName: string) =>
                format(f, value, `table-${id}-field-${index}-${cellName}`),
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
  }, [api, bulkGenerateInfo.fields, height, id, parentId, tableId, template]);

  return (
    <div class="mt-3">
      <table id={tableId} style={{ whiteSpace: "nowrap" }}></table>
    </div>
  );
};
