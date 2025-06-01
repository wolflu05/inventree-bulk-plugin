import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { type InvenTreePluginContext } from "@inventreedb/ui";

export const InvenTreeContext = createContext<InvenTreePluginContext | undefined>(undefined);

export const useInvenTreeContext = () => {
  return useContext(InvenTreeContext)!;
};

export const useApi = () => {
  const context = useInvenTreeContext();
  return context.api;
};
