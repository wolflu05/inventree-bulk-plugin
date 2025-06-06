import { ModelType } from "@inventreedb/ui";
import { darken, Input, useMantineColorScheme } from "@mantine/core";
import { useDebouncedValue, useId } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";

import { RenderInstance } from "./render/Instance";
import { useApi } from "../../contexts/InvenTreeContext";

/**
 * Render a 'select' field for searching the database against a particular model type
 */
export function RelatedModelField({
  value: pk = null,
  onChange: setPk,
  limit = 10,
  api_url,
  disabled,
  hidden,
  filters: _filtersProp,
  modelRenderer,
  model,
  label,
  required,
  placeholder,
}: Readonly<{
  label?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  required?: boolean;
  placeholder?: string;
  limit?: number;
  api_url: string;
  disabled?: boolean;
  hidden?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelRenderer?: (instance: any) => ReactElement;
  model: ModelType;
}>) {
  const pk_field = model === ("part_image" as ModelType) ? "image" : "pk";

  const api = useApi();
  const fieldId = useId();

  const [offset, setOffset] = useState<number>(0);

  const [initialData, setInitialData] = useState<Record<string, string>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataRef = useRef<any[]>([]);

  const [isOpen, setIsOpen] = useState<boolean>(false);

  // If an initial value is provided, load from the API
  useEffect(() => {
    if (pk) {
      const url = model === ("part_image" as ModelType) ? api_url : `${api_url}${pk}/`;

      if (!url) {
        setPk(null);
        return;
      }

      api.get(url).then((response) => {
        if (model === ("part_image" as ModelType)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const image = response.data.find((x: any) => x.image === pk) || { image: "", id: pk };
          const value = {
            value: image.image,
            data: image,
          };
          setInitialData(value);
          dataRef.current = [value];
        } else if (response.data?.[pk_field]) {
          const value = {
            value: response.data[pk_field],
            data: response.data,
          };
          setInitialData(value);
          dataRef.current = [value];
          setPk(response.data[pk_field]);
        }
      });
    } else {
      setPk(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search input query
  const [value, setValue] = useState<string>("");
  const [searchText] = useDebouncedValue(value, 250);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [filters, setFilters] = useState<any>({});

  const resetSearch = useCallback(() => {
    setOffset(0);
    setData([]);
    dataRef.current = [];
  }, []);

  // reset current data on search value change
  useEffect(() => {
    resetSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, filters]);

  const selectQuery = useQuery({
    enabled: isOpen && !disabled && !!api_url && !hidden,
    queryKey: [`related-field-${label}`, fieldId, offset, searchText],
    queryFn: async () => {
      if (!api_url) {
        return null;
      }

      const _filters = _filtersProp ?? {};

      // If the filters have changed, clear the data
      if (JSON.stringify(_filters) !== JSON.stringify(filters)) {
        resetSearch();
        setFilters(_filters);
      }

      const params = {
        ..._filters,
        search: searchText,
        offset,
        limit,
      };

      return api
        .get(api_url, {
          params,
        })
        .then((response) => {
          // current values need to be accessed via a ref, otherwise "data" has old values here
          // and this results in no overriding the data which means the current value cannot be displayed
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const values: any[] = [...dataRef.current];
          const alreadyPresentPks = values.map((x) => x.value);

          const results = response.data?.results ?? response.data ?? [];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          results.forEach((item: any) => {
            const pk = item[pk_field];

            if (pk && !alreadyPresentPks.includes(pk)) {
              values.push({
                value: pk,
                data: item,
              });
            }
          });

          setData(values);
          dataRef.current = values;
          return response;
        })
        .catch((error) => {
          setData([]);
          return error;
        });
    },
  });

  /**
   * Format an option for display in the select field
   */
  const formatOption = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (option: any) => {
      const data = option.data ?? option;

      if (modelRenderer) {
        const MR = modelRenderer;
        return <MR instance={data} />;
      }

      return <RenderInstance instance={data} model={model ?? undefined} />;
    },
    [model, modelRenderer],
  );

  // Update form values when the selected value changes
  const onChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (value: any) => {
      const _pk = value?.value ?? null;

      setPk(_pk);
    },
    [setPk],
  );

  const currentValue = useMemo(() => {
    if (!pk) {
      return null;
    }

    const _data = [...data, initialData];
    return _data.find((item) => item.value === pk);
  }, [pk, data, initialData]);

  // Field doesn't follow Mantine theming
  // Define color theme to pass to field based on Mantine theme
  const { colorScheme } = useMantineColorScheme();

  const colors = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let colors: any;
    if (colorScheme === "dark") {
      colors = {
        neutral0: "var(--mantine-color-dark-6)",
        neutral5: "var(--mantine-color-dark-4)",
        neutral10: "var(--mantine-color-dark-4)",
        neutral20: "var(--mantine-color-dark-4)",
        neutral30: "var(--mantine-color-dark-3)",
        neutral40: "var(--mantine-color-dark-2)",
        neutral50: "var(--mantine-color-dark-1)",
        neutral60: "var(--mantine-color-dark-0)",
        neutral70: "var(--mantine-color-dark-0)",
        neutral80: "var(--mantine-color-dark-0)",
        neutral90: "var(--mantine-color-dark-0)",
        primary: "var(--mantine-primary-color-7)",
        primary25: "var(--mantine-primary-color-6)",
        primary50: "var(--mantine-primary-color-5)",
        primary75: "var(--mantine-primary-color-4)",
      };
    } else {
      colors = {
        neutral0: "var(--mantine-color-white)",
        neutral5: darken("var(--mantine-color-white)", 0.05),
        neutral10: darken("var(--mantine-color-white)", 0.1),
        neutral20: darken("var(--mantine-color-white)", 0.2),
        neutral30: darken("var(--mantine-color-white)", 0.3),
        neutral40: darken("var(--mantine-color-white)", 0.4),
        neutral50: darken("var(--mantine-color-white)", 0.5),
        neutral60: darken("var(--mantine-color-white)", 0.6),
        neutral70: darken("var(--mantine-color-white)", 0.7),
        neutral80: darken("var(--mantine-color-white)", 0.8),
        neutral90: darken("var(--mantine-color-white)", 0.9),
        primary: "var(--mantine-primary-color-7",
        primary25: "var(--mantine-primary-color-4)",
        primary50: "var(--mantine-primary-color-5)",
        primary75: "var(--mantine-primary-color-6)",
      };
    }
    return colors;
  }, [colorScheme]);

  return (
    <Input.Wrapper label={label} size="xs" flex={1}>
      <Select
        id={fieldId}
        value={currentValue}
        options={data}
        filterOption={null}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onInputChange={(value: any) => {
          setValue(value);
          resetSearch();
        }}
        onChange={onChange}
        onMenuScrollToBottom={() => setOffset(offset + limit)}
        onMenuOpen={() => {
          setIsOpen(true);
          resetSearch();
          selectQuery.refetch();
        }}
        onMenuClose={() => {
          setIsOpen(false);
        }}
        isLoading={selectQuery.isFetching || selectQuery.isLoading || selectQuery.isRefetching}
        isClearable={!required}
        isDisabled={disabled}
        isSearchable={true}
        placeholder={placeholder || `Search...`}
        loadingMessage={() => `Loading...`}
        menuPortalTarget={document.body}
        noOptionsMessage={() => `No results found`}
        menuPosition="fixed"
        styles={{
          control: (base) => ({
            ...base,
            minHeight: 35,
            maxHeight: 35,
          }),
          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatOptionLabel={(option: any) => formatOption(option)}
        theme={(theme) => {
          return {
            ...theme,
            colors: {
              ...theme.colors,
              ...colors,
            },
          };
        }}
      />
    </Input.Wrapper>
  );
}
