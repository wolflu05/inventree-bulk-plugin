import type { ModelType } from "@inventreedb/ui";
import { Loader } from "@mantine/core";
import { useMemo, useState } from "react";

import { RenderInstance } from "./Instance";
import { useApi } from "../../../contexts/InvenTreeContext";

/**
 * Render a model instance from a URL
 * @param model Model type
 * @param url URL to fetch instance from
 * @returns JSX Element
 */
export function InstanceFromUrl({
  model,
  url,
}: Readonly<{
  model: ModelType;
  url: string;
}>) {
  const api = useApi();
  const [data, setData] = useState<unknown>(null);
  useMemo(
    () =>
      api.get(url).then((res) => {
        setData(res.data);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, url, model],
  );

  if (!data) return <Loader />;

  return <RenderInstance instance={data} model={model} />;
}
