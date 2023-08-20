import { ComponentChildren } from "preact";
import { useEffect, useId } from "preact/hooks";

import "./Tooltip.css";

interface TooltipProps {
  text?: string;
  placement?: "right" | "left" | "bottom" | "top" | "auto";
  children: ComponentChildren;
}

export function Tooltip({ text, children, placement = "auto" }: TooltipProps) {
  const id = useId();

  useEffect(() => {
    const el = document.getElementById(id);
    if (!el) return;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const tooltip = bootstrap.Tooltip.getOrCreateInstance(el, { placement });

    return () => {
      tooltip.dispose();
    };
  }, [id, placement]);

  if (!text) {
    return <>{children}</>;
  }

  return (
    <div id={id} class="preact-tooltip" data-bs-title={text} data-bs-toggle="tooltip">
      {children}
    </div>
  );
}
