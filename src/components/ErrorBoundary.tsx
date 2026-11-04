import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "../i18n/sr";

interface State {
  error: Error | null;
}

/** Catches render errors so a bug shows a message with a reload button instead of a blank window. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="screen">
        <h1>{t.crash.title}</h1>
        <p className="muted">{t.crash.hint}</p>
        <p className="error">{this.state.error.message}</p>
        <button type="button" className="button button-primary" onClick={() => window.location.reload()}>
          {t.crash.reload}
        </button>
      </main>
    );
  }
}
