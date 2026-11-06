import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { t } from "../i18n/en";
import { Icon } from "./Icon";

export interface RowMenuItem {
  label: string;
  danger?: boolean;
  onSelect(): void;
}

/**
 * A "more" button that opens a small menu. The menu is fixed-positioned so no
 * table or scroll container can clip it; arrow keys move between items,
 * Escape and outside clicks close it, and focus returns to the button.
 */
export function RowMenu({ items, label = t.actions.more }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    // The menu is fixed-positioned: follow the button when the page scrolls or the window resizes.
    const onMove = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const options = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []);
    if (options.length === 0) return;
    const index = options.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => options[(i + options.length) % options.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(options.length - 1);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  function select(item: RowMenuItem) {
    // Focus the button first so a dialog the item opens returns focus here, not to a removed menu item.
    close(true);
    item.onSelect();
  }

  return (
    <div className="row-menu">
      <button
        ref={buttonRef}
        type="button"
        className="button button-icon-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => (open ? close(false) : openMenu())}
      >
        <Icon name="more" />
      </button>
      {open && (
        <div ref={menuRef} className="menu" role="menu" aria-label={label} style={{ top: position.top, right: position.right }} onKeyDown={onMenuKeyDown}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`menu-item ${item.danger ? "menu-item-danger" : ""}`}
              onClick={() => select(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
