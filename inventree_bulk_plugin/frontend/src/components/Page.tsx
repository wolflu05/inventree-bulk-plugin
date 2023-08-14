import { ComponentChildren } from "preact";

import { GenerateKeysWrapper } from "../contexts/GenerateKeys";
import { NotificationWrapper } from "../contexts/Notification";

interface PageProps {
  children: ComponentChildren;
}

export const Page = ({ children }: PageProps) => {
  return (
    <NotificationWrapper>
      <GenerateKeysWrapper>{children}</GenerateKeysWrapper>
    </NotificationWrapper>
  );
};
