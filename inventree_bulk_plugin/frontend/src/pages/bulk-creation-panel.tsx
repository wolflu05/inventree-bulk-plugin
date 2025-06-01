import { render as preact_render } from "preact";

import { type InvenTreePluginContext } from "@inventreedb/ui";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";

import { BulkGenerateView } from "../components/BulkGenerateView";
import { InvenTreeContext } from "../contexts/InvenTreeContext";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

export function renderPanel(ref: HTMLDivElement, inventreeContext: InvenTreePluginContext) {
  preact_render(
    <InvenTreeContext.Provider value={inventreeContext}>
      <MantineProvider
        theme={inventreeContext.theme}
        forceColorScheme={inventreeContext.colorScheme === "auto" ? undefined : inventreeContext.colorScheme}
        getRootElement={() => ref}
      >
        <Notifications />
        <BulkGenerateView
          templateType={inventreeContext.context.args.objectType}
          parentId={inventreeContext.id as unknown as string}
        />
      </MantineProvider>
    </InvenTreeContext.Provider>,
    ref,
  );
}
