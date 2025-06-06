import { Badge } from "@mantine/core";

import { RenderInlineModel } from "./Instance";

export function RenderPlugin({
  instance,
}: Readonly<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: Readonly<any>;
}>) {
  return (
    <RenderInlineModel
      primary={instance.name}
      secondary={instance.meta?.description}
      suffix={
        !instance.active ? (
          <Badge size="sm" color="red">
            Inactive
          </Badge>
        ) : (
          <></>
        )
      }
    />
  );
}
