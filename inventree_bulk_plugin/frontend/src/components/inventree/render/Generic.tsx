import { type InstanceRenderInterface, RenderInlineModel } from "./Instance";

export function RenderProjectCode({ instance }: Readonly<InstanceRenderInterface>) {
  return instance && <RenderInlineModel primary={instance.code} secondary={instance.description} />;
}

export function RenderContentType({ instance }: Readonly<InstanceRenderInterface>) {
  return instance && <RenderInlineModel primary={instance.app_labeled_name} />;
}

export function RenderError({ instance }: Readonly<InstanceRenderInterface>) {
  return instance && <RenderInlineModel primary={instance.name} />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RenderImportSession({ instance }: { instance: any }) {
  return instance && <RenderInlineModel primary={instance.data_file} />;
}

export function RenderSelectionList({ instance }: Readonly<InstanceRenderInterface>) {
  return instance && <RenderInlineModel primary={instance.name} secondary={instance.description} />;
}
