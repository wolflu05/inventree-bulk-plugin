import { render as preact_render } from "preact";
import { BulkGenerateView } from "../components/generateBulkCreateView";
import { PageRenderProps, TemplateType } from "../utils/types";

export function render({ target, ctxId }: PageRenderProps) {
    preact_render(<BulkGenerateView
        createURL={`/plugin/inventree-bulk-plugin/bulkcreate/category/${ctxId}`}
        name="categories"
        defaultSchema={null}
        templateType={TemplateType.PART_CATEGORY}
    />, target)
}
