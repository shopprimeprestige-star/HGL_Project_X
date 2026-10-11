import React from "react";

/**
 * Renders a text where [a]...[/a] becomes a brand highlight span,
 * and \n becomes a line break.
 */
export function RichText({
  value,
  highlightClass = "text-brand font-semibold",
  className,
}: {
  value: string;
  highlightClass?: string;
  className?: string;
}) {
  const nodes: React.ReactNode[] = [];
  const lines = (value || "").split("\n");
  lines.forEach((line, li) => {
    const parts = line.split(/(\[a\][\s\S]*?\[\/a\])/g);
    parts.forEach((part, pi) => {
      const m = part.match(/^\[a\]([\s\S]*?)\[\/a\]$/);
      if (m) {
        nodes.push(
          <span key={`h-${li}-${pi}`} className={highlightClass}>
            {m[1]}
          </span>,
        );
      } else if (part) {
        nodes.push(<React.Fragment key={`t-${li}-${pi}`}>{part}</React.Fragment>);
      }
    });
    if (li < lines.length - 1) nodes.push(<br key={`br-${li}`} />);
  });
  return <span className={className}>{nodes}</span>;
}

