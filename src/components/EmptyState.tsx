import type { ReactNode } from "react";

interface Props {
  /** The one fact: what this list is and why it is empty. */
  title: string;
  /** What would fill it. */
  hint?: string;
  /** The control that does so, when there is one. */
  action?: ReactNode;
}

/** Empty list placeholder that names the state and offers the next step. */
export function EmptyState({ title, hint, action }: Props) {
  return (
    <div className="empty-state" role="status">
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
