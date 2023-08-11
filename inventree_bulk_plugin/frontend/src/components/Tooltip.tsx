import { ComponentChildren } from "preact";
import "./Tooltip.css";

interface TooltipProps {
    text?: string;
    children: ComponentChildren;
}

export function Tooltip({ text, children }: TooltipProps) {
    if (!text) {
        return <>{children}</>;
    }

    return <div class="preact-tooltip">
        {children}
        <span class="preact-tooltiptext">{text}</span>
    </div>;
}
