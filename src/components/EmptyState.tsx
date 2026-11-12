import type { ReactNode } from "react";

interface Props {
  /** The one fact: what this list is and why it is empty. */
  title: string;
  /** What would fill it. */
  hint?: string;
  /** The control that does so, when there is one. */
  action?: ReactNode;
  /**
   * Read out when it appears: for an empty state the user's own filtering caused. A list that is simply empty is
   * not news, and a live region there would speak whenever its hint changed (sync turning on or off).
   */
  announce?: boolean;
}

/** Empty list placeholder that names the state and offers the next step. */
export function EmptyState({ title, hint, action, announce = false }: Props) {
  return (
    <div className="empty-state" role={announce ? "status" : undefined}>
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
