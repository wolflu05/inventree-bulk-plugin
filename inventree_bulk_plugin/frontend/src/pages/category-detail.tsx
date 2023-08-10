import { render as preact_render } from "preact";
import { BulkGenerateView } from "../components/generateBulkCreateView";

export function render({ target, ctxId }) {
    preact_render(<BulkGenerateView
        createURL={`/plugin/inventree-bulk-plugin/bulkcreate/category/${ctxId}`}
        name="categories"
        defaultSchema={null}
        templateType="PART_CATEGORY"
    />, target)
}
