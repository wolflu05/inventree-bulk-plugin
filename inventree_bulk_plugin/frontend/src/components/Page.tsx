import { ComponentChildren } from "preact";

import { BulkGenerateInfoWrapper } from "../contexts/BulkCreateInfo";
import { NotificationWrapper } from "../contexts/Notification";

interface PageProps {
  children: ComponentChildren;
}

export const Page = ({ children }: PageProps) => {
  return (
    <NotificationWrapper>
      <BulkGenerateInfoWrapper>{children}</BulkGenerateInfoWrapper>
    </NotificationWrapper>
  );
};
