import type { ModelType } from "@inventreedb/ui";
import { Skeleton } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { RenderInstance } from "./Instance";
import { useApi } from "../../../contexts/InvenTreeContext";
import { FieldDefinitionModel } from "../../../utils/types";

export function InstanceFromUrl({
  model,
  pk,
}: Readonly<{
  model: FieldDefinitionModel["model"];
  pk: string;
}>) {
  const api = useApi();
  const modelType = useMemo(() => {
    return model.model.split(".")[1].toLowerCase();
  }, [model.model]);

  const { data: _data, isLoading } = useQuery({
    queryKey: modelType === "part_image" ? [modelType] : [modelType, pk],
    queryFn: () => {
      const url = modelType === "part_image" ? model.api_url : `${model.api_url}${pk}/`;
      return api.get(url).then((res) => res.data);
    },
  });

  const data = useMemo(() => {
    if (modelType === "part_image" && !isLoading && _data) {
      return _data.find((item: { image: string }) => item.image === pk) || null;
    }

    return _data;
  }, [_data, isLoading, modelType, pk]);

  if (isLoading) return <Skeleton />;

  return <RenderInstance instance={data} model={modelType as ModelType} />;
}
