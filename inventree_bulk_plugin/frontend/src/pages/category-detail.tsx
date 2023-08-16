import { render as preact_render } from "preact";

import { BulkGenerateView } from "../components/BulkGenerateView";
import { Page } from "../components/Page";
import { PageRenderProps, TemplateType } from "../utils/types";

export function render({ target, ctxId }: PageRenderProps) {
  preact_render(
    <Page>
      <BulkGenerateView templateType={TemplateType.PART_CATEGORY} parentId={ctxId} />
    </Page>,
    target,
  );
}
