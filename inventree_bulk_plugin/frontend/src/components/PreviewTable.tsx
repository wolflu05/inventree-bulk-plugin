import { useEffect, useId, useMemo, useState } from "preact/hooks";

import { Box, List } from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { IconChevronRight } from "@tabler/icons-preact";
import clsx from "clsx";
import { DataTable } from "mantine-datatable";

import { InstanceFromUrl } from "./inventree/render/InstanceFromUrl";
import { useApi } from "../contexts/InvenTreeContext";
import { beautifySchema, getCounter, getUsedGenerateKeys, mapNestedObject, NestedObjectType, toFlat } from "../utils";
import { AxiosError, URLS } from "../utils/api";
import { BulkGenerateInfo, FieldDefinition, TemplateModel } from "../utils/types";

import classes from "./PreviewTable.module.css";
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

  const [data, setData] = useState<NestedObjectType>([]);
  const [headers, setHeaders] = useState<[string, FieldDefinition][]>([]);

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

      const nestedData = mapNestedObject(res.data, getCounter());

      setHeaders(Object.entries(bulkGenerateInfo.fields).filter(([key]) => usedGenerateKeys.includes(key)));
      setData(nestedData);
    })();
  }, [api, bulkGenerateInfo.fields, height, id, parentId, tableId, template]);

  return <NestedDataTable headers={headers} data={data} />;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TableCell = ({ fieldDefinition, data }: { fieldDefinition: FieldDefinition; data: any }) => {
  if (fieldDefinition.field_type === "model") {
    if (data === null || data === undefined) return "";
    return <InstanceFromUrl model={fieldDefinition.model} pk={data} />;
  }

  if (fieldDefinition.field_type === "select") {
    return <span>{fieldDefinition.options[data as string] ?? `${data}`}</span>;
  }

  if (fieldDefinition.field_type === "list" && Array.isArray(data)) {
    return (
      <List>
        {data.map((r) => (
          <List.Item>
            <TableCell fieldDefinition={fieldDefinition.items_type} data={r} />
          </List.Item>
        ))}
      </List>
    );
  }

  if (fieldDefinition.field_type === "object" && typeof data === "object") {
    return (
      <List listStyleType="none">
        {Object.entries(data).map(([k, r]) => (
          <List.Item>
            {fieldDefinition.fields[k].name ?? k}: <TableCell fieldDefinition={fieldDefinition.fields[k]} data={r} />
          </List.Item>
        ))}
      </List>
    );
  }

  if (typeof data === "object") return JSON.stringify(data, null, 2);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data !== undefined ? `${data}` : null) as any;
};

const NestedDataTable = ({
  headers,
  data,
  level = 0,
}: {
  headers: [string, FieldDefinition][];
  data: NestedObjectType;
  level?: number;
}) => {
  const [expandedIds, setExpandedIds] = useState<number[]>(() =>
    data.filter((d) => d.childs.length > 0).map((d) => d.id),
  );

  // Expand first nodes with childs on initial render
  useEffect(() => {
    const firstId = data.find((d) => d.childs.length > 0)?.id;
    setExpandedIds(firstId === undefined ? [] : [firstId]);
  }, [data]);

  const columns = useMemo(
    () => [
      ...headers.map(([key, f]) => ({
        accessor: key,
        title: f.name,
        noWrap: true,
        width: 300,
        render: (record: Record<string, unknown>) => {
          if (key === "name") {
            return (
              <Box ml={level * 40} component="span" align="center" display="flex">
                {(record.childs as Array<unknown>).length > 0 && (
                  <IconChevronRight
                    size={16}
                    className={clsx(classes.icon, classes.expandIcon, {
                      [classes.expandIconRotated]: expandedIds.includes(record.id as number),
                    })}
                  />
                )}
                <TableCell fieldDefinition={f} data={record[key]} />
              </Box>
            );
          }

          return <TableCell fieldDefinition={f} data={record[key]} />;
        },
      })),
      { accessor: "path", title: "Path", width: 300 },
    ],
    [expandedIds, headers, level],
  );

  return (
    <DataTable
      withTableBorder={level === 0}
      highlightOnHover={level === 0}
      withColumnBorders
      noHeader={level > 0}
      columns={columns}
      records={data}
      rowExpansion={{
        allowMultiple: true,
        expandable: ({ record }) => record.childs.length > 0,
        expanded: {
          recordIds: expandedIds,
          onRecordIdsChange: setExpandedIds,
        },
        content: ({ record }) => {
          return <NestedDataTable headers={headers} data={record.childs} level={level + 1} />;
        },
      }}
    />
  );
};
