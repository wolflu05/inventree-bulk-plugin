import { ReactElement } from "preact/compat";

import { Tooltip as MantineTooltip } from "@mantine/core";

interface TooltipProps {
  text?: string;
  placement?: "right" | "left" | "bottom" | "top" | "auto";
  children: ReactElement;
}

export function Tooltip({ text, children, placement = "auto" }: TooltipProps) {
  if (!text) {
    return children;
  }

  return (
    <MantineTooltip label={text} position={placement === "auto" ? undefined : placement} multiline maw={300}>
      {children}
    </MantineTooltip>
  );
}
