import { ComponentChildren, createContext } from "preact";
import { useCallback, useContext, useEffect, useState } from "preact/hooks";

import { useNotifications } from "./Notification";
import { URLS, fetchAPI } from "../utils/api";
import { GenerateKeys, TemplateType } from "../utils/types";

interface GenerateKeysContextType {
  generateKeys: Record<string, GenerateKeys>;
  reload: () => Promise<void>;
}

const GenerateKeysContext = createContext<GenerateKeysContextType>({
  generateKeys: {},
  reload: async () => {
    //
  },
});

export const useGenerateKeys = () => {
  const { generateKeys, reload } = useContext(GenerateKeysContext);
  return { generateKeys, reload };
};

export const useGenerateKeysForTemplateType = (templateType: TemplateType) => {
  const { generateKeys } = useContext(GenerateKeysContext);
  return generateKeys[templateType];
};

interface GenerateKeysWrapperProps {
  children: ComponentChildren;
}

export const GenerateKeysWrapper = ({ children }: GenerateKeysWrapperProps) => {
  const [generateKeys, setGenerateKeys] = useState({});

  const { showNotification } = useNotifications();

  const reload = useCallback(async () => {
    const res = await fetchAPI(URLS.bulkcreate());

    if (!res.ok) {
      return showNotification({ type: "danger", message: `Could not load generate keys, ${res.statusText}` });
    }

    const generateKeys = Object.fromEntries(
      (await res.json()).map((x: { template_type: string; fields: Array<GenerateKeys> }) => [
        x.template_type,
        x.fields,
      ]),
    ) as Record<string, GenerateKeys>;
    setGenerateKeys(generateKeys);
  }, [showNotification]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <GenerateKeysContext.Provider
      value={{
        generateKeys,
        reload,
      }}
    >
      {children}
    </GenerateKeysContext.Provider>
  );
};
