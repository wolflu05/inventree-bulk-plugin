import { RenderInlineModel } from "./Instance";

export function RenderReportTemplate({
  instance,
}: Readonly<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any;
}>) {
  return <RenderInlineModel primary={instance.name} secondary={instance.description} />;
}

export function RenderLabelTemplate({
  instance,
}: Readonly<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any;
}>) {
  return <RenderInlineModel primary={instance.name} secondary={instance.description} />;
}
