import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortDir } from "@/crm/useSortableTable";

// Header cella cliccabile con indicatore freccia stile Meta.
// Usabile sia in <th> che in div-based table.
export function SortableHeader({
  label,
  labelNode,
  active,
  dir,
  align = "right",
  onClick,
  className = "",
}: {
  label: string;
  /** Override visivo per il label (es. wrapping con tooltip). */
  labelNode?: ReactNode;
  active: boolean;
  dir: SortDir;
  align?: "left" | "right" | "center";
  onClick: () => void;
  className?: string;
}) {
  const alignCls = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  const Icon = !active ? ArrowUpDown : dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex items-center gap-1 ${alignCls} w-full hover:text-foreground transition-colors ${active ? "text-foreground" : "text-muted-foreground"} ${className}`}
      title={
        !active
          ? "Clicca per ordinare dal più alto"
          : dir === "desc"
          ? "Clicca per ordinare dal più basso"
          : "Clicca per rimuovere l'ordinamento"
      }
    >
      {labelNode ?? <span className="truncate">{label}</span>}
      <Icon
        className={`h-3 w-3 shrink-0 ${active ? "text-[oklch(0.55_0.18_252)]" : "opacity-0 group-hover:opacity-60"}`}
      />
    </button>
  );
}
