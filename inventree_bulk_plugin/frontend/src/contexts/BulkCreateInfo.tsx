import { ComponentChildren, createContext } from "preact";
import { useCallback, useContext, useEffect, useState } from "preact/hooks";

import { useNotifications } from "./Notification";
import { URLS, fetchAPI } from "../utils/api";
import { BulkGenerateInfo } from "../utils/types";

interface BulkGenerateInfoContextType {
  bulkGenerateInfoDict: Record<string, BulkGenerateInfo>;
  reload: () => Promise<void>;
}

const BulkGenerateInfoContext = createContext<BulkGenerateInfoContextType>({
  bulkGenerateInfoDict: {},
  reload: async () => {
    //
  },
});

export const useBulkGenerateInfo = () => {
  const { bulkGenerateInfoDict, reload } = useContext(BulkGenerateInfoContext);
  return { bulkGenerateInfoDict, reload };
};

interface BulkGenerateInfoWrapperProps {
  children: ComponentChildren;
}

export const BulkGenerateInfoWrapper = ({ children }: BulkGenerateInfoWrapperProps) => {
  const [bulkGenerateInfoDict, setBulkGenerateInfoDict] = useState<Record<string, BulkGenerateInfo>>({});

  const { showNotification } = useNotifications();

  const reload = useCallback(async () => {
    const res = await fetchAPI(URLS.bulkcreate());

    if (!res.ok) {
      return showNotification({ type: "danger", message: `Could not load bulk generate info, ${res.statusText}` });
    }

    const bulkGenerateInfo: Record<string, BulkGenerateInfo> = Object.fromEntries(
      (await res.json()).map((x: BulkGenerateInfo) => [x.template_type, x]),
    );
    setBulkGenerateInfoDict(bulkGenerateInfo);
  }, [showNotification]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <BulkGenerateInfoContext.Provider
      value={{
        bulkGenerateInfoDict,
        reload,
      }}
    >
      {children}
    </BulkGenerateInfoContext.Provider>
  );
};
