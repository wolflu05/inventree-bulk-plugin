import { getDetailUrl, ModelType } from "@inventreedb/ui";

import { type InstanceRenderInterface, RenderInlineModel } from "./Instance";
import { StatusRenderer } from "./StatusRenderer";

/**
 * Inline rendering of a single BuildOrder instance
 */
export function RenderBuildOrder(props: Readonly<InstanceRenderInterface>) {
  const { instance } = props;

  return (
    <RenderInlineModel
      {...props}
      primary={instance.reference}
      secondary={instance.title}
      suffix={StatusRenderer({
        status: instance.status_custom_key,
        type: ModelType.build,
      })}
      image={instance.part_detail?.thumbnail || instance.part_detail?.image}
      url={props.link ? getDetailUrl(ModelType.build, instance.pk) : undefined}
    />
  );
}

/*
 * Inline rendering of a single BuildLine instance
 */
export function RenderBuildLine({ instance }: Readonly<InstanceRenderInterface>) {
  return (
    <RenderInlineModel
      primary={instance.part_detail.full_name}
      secondary={instance.quantity}
      suffix={StatusRenderer({
        status: instance.status_custom_key,
        type: ModelType.build,
      })}
      image={instance.part_detail.thumbnail || instance.part_detail.image}
    />
  );
}

export function RenderBuildItem({ instance }: Readonly<InstanceRenderInterface>) {
  return <RenderInlineModel primary={instance.pk} />;
}
