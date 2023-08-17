import { render as preact_render } from "preact";

import { BulkGenerateView } from "../components/BulkGenerateView";
import { Page } from "../components/Page";
import { PageRenderProps } from "../utils/types";

export function render({ target, objectId, objectType }: PageRenderProps) {
  preact_render(
    <Page>
      <BulkGenerateView templateType={objectType} parentId={objectId} />
    </Page>,
    target,
  );
}
