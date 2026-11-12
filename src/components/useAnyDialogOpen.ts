import { useEffect, useState } from "react";

/** Whether a dialog is open anywhere on the page (a modal covers what is under it, a running clock included). */
export function useAnyDialogOpen(): boolean {
  const [open, setOpen] = useState(() => typeof document !== "undefined" && document.querySelector("dialog[open]") !== null);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const update = () => setOpen(document.querySelector("dialog[open]") !== null);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    update();
    return () => observer.disconnect();
  }, []);
  return open;
}
