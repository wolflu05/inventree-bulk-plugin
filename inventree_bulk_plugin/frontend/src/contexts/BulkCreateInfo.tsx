import { createContext } from "preact";
import { ReactNode } from "preact/compat";
import { useCallback, useContext, useEffect, useState } from "preact/hooks";

import { showNotification } from "@mantine/notifications";

import { useApi } from "./InvenTreeContext";
import { AxiosError, URLS } from "../utils/api";
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
  children: ReactNode;
}

export const BulkGenerateInfoWrapper = ({ children }: BulkGenerateInfoWrapperProps) => {
  const [bulkGenerateInfoDict, setBulkGenerateInfoDict] = useState<Record<string, BulkGenerateInfo>>({});

  const api = useApi();

  const reload = useCallback(async () => {
    let res;
    try {
      res = await api.get(URLS.bulkcreate());
    } catch (err) {
      showNotification({
        color: "red",
        message: `Could not load bulk generate info, ${(err as AxiosError).response?.statusText}`,
      });
      return;
    }

    const bulkGenerateInfo: Record<string, BulkGenerateInfo> = Object.fromEntries(
      res.data.map((x: BulkGenerateInfo) => [x.template_type, x]),
    );
    setBulkGenerateInfoDict(bulkGenerateInfo);
  }, [api]);

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
