import { ModelType, getDetailUrl } from "@inventreedb/ui";
import { Badge } from "@mantine/core";

import { type InstanceRenderInterface, RenderInlineModel } from "./Instance";

/**
 * Inline rendering of a single Part instance
 */
export function RenderPart(props: Readonly<InstanceRenderInterface>) {
  const { instance } = props;

  let badgeText = "";
  let badgeColor = "";

  const stock: number | null = instance.total_in_stock ?? null;

  if (instance.active == false) {
    badgeColor = "red";
    badgeText = `Inactive`;
  } else if (stock != null && stock <= 0) {
    badgeColor = "orange";
    badgeText = `No stock`;
  } else if (stock != null) {
    badgeText = `${`Stock`}: ${stock}`;
    badgeColor = instance.minimum_stock > stock ? "yellow" : "green";
  }

  const badge = badgeText ? (
    <Badge size="xs" color={badgeColor}>
      {badgeText}
    </Badge>
  ) : null;

  return (
    <RenderInlineModel
      {...props}
      primary={instance.full_name ?? instance.name}
      secondary={instance.description}
      suffix={badge || <></>}
      image={instance.thumnbnail || instance.image}
      url={props.link ? getDetailUrl(ModelType.part, instance.pk) : undefined}
    />
  );
}

/**
 * Inline rendering of a single Part instance
 */
export function RenderPartImage(props: Readonly<InstanceRenderInterface>) {
  const { instance } = props;

  let badgeText = "";
  let badgeColor = "";

  const stock: number | null = instance.total_in_stock ?? null;

  if (instance.active == false) {
    badgeColor = "red";
    badgeText = `Inactive`;
  } else if (stock != null && stock <= 0) {
    badgeColor = "orange";
    badgeText = `No stock`;
  } else if (stock != null) {
    badgeText = `${`Stock`}: ${stock}`;
    badgeColor = instance.minimum_stock > stock ? "yellow" : "green";
  }

  const badge = badgeText ? (
    <Badge size="xs" color={badgeColor}>
      {badgeText}
    </Badge>
  ) : null;

  return (
    <RenderInlineModel
      {...props}
      primary={instance.image}
      secondary={`(x${instance.count})`}
      suffix={badge}
      image={`/media/${instance.image}`}
      url={props.link ? getDetailUrl(ModelType.part, instance.pk) : undefined}
    />
  );
}

/**
 * Inline rendering of a PartCategory instance
 */
export function RenderPartCategory(props: Readonly<InstanceRenderInterface>) {
  const { instance } = props;

  return (
    <RenderInlineModel
      {...props}
      tooltip={instance.pathstring}
      prefix={
        <>
          {instance.level > 0 && `${"- ".repeat(instance.level)}`}
          {/* {instance.icon && <ApiIcon name={instance.icon} />} */}
        </>
      }
      primary={instance.pathstring}
      secondary={instance.description}
      url={props.link ? getDetailUrl(ModelType.partcategory, instance.pk) : undefined}
    />
  );
}

/**
 * Inline rendering of a PartParameterTemplate instance
 */
export function RenderPartParameterTemplate({
  instance,
}: Readonly<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any;
}>) {
  return <RenderInlineModel primary={instance.name} secondary={instance.description} suffix={instance.units} />;
}

export function RenderPartTestTemplate({
  instance,
}: Readonly<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any;
}>) {
  return <RenderInlineModel primary={instance.test_name} secondary={instance.description} />;
}
