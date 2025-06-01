import { IconUser, IconUsersGroup } from "@tabler/icons-preact";

import { type InstanceRenderInterface, RenderInlineModel } from "./Instance";

export function RenderOwner({ instance }: Readonly<InstanceRenderInterface>) {
  return (
    instance && (
      <RenderInlineModel
        primary={instance.name}
        suffix={instance.label == "group" ? <IconUsersGroup size={16} /> : <IconUser size={16} />}
      />
    )
  );
}

export function RenderUser({ instance }: Readonly<InstanceRenderInterface>) {
  return (
    instance && (
      <RenderInlineModel primary={instance.username} secondary={`${instance.first_name} ${instance.last_name}`} />
    )
  );
}

export function RenderGroup({ instance }: Readonly<InstanceRenderInterface>) {
  return instance && <RenderInlineModel primary={instance.name} />;
}
