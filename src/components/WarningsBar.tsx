import { t } from "../i18n/en";

/** Short list of plan problems above the table; hidden when there are none. */
export function WarningsBar({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="warnings" role="status">
      <strong>{t.warnings.title}</strong>
      <ul>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
