import type { ReactNode } from "react";

interface Props {
  label: string;
  icon: ReactNode;
  variant?: "default" | "success";
  onClick(): void;
}

/** Square icon button; the label goes into the tooltip and the accessible name. */
export function IconButton({ label, icon, variant = "default", onClick }: Props) {
  return (
    <button
      type="button"
      className={`button button-icon-sm ${variant === "success" ? "button-icon-success" : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}
