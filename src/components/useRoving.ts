import { useLayoutEffect, type FocusEvent, type KeyboardEvent, type RefObject } from "react";

interface Options {
  /** The group's controls, in DOM order. */
  selector: string;
  /** The control that carries the group's Tab stop until one is focused, e.g. the row's title. */
  entry?: string;
  /** Controls inside this ancestor are not part of the group (an open menu's items). */
  exclude?: string;
  /** Click the control an arrow key moved to, for radio-like groups. */
  activateOnMove?: boolean;
}

/**
 * One Tab stop for a group of controls; Left/Right, Home and End move within
 * it. The hook keeps exactly one control at tabindex 0 across re-renders (a
 * drag handle that re-asserts tabindex 0 is put back) and remembers the last
 * focused control so Shift+Tab returns to it.
 */
export function useRovingGroup(ref: RefObject<HTMLElement | null>, { selector, entry, exclude, activateOnMove = false }: Options) {
  function items(): HTMLElement[] {
    const root = ref.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => !el.hasAttribute("disabled") && !(exclude && el.closest(exclude) !== null && el.closest(exclude) !== root),
    );
  }

  function mark(active: HTMLElement, all: HTMLElement[]) {
    for (const el of all) {
      el.tabIndex = el === active ? 0 : -1;
      if (el === active) el.dataset.rovingCurrent = "true";
      else delete el.dataset.rovingCurrent;
    }
  }

  useLayoutEffect(() => {
    const all = items();
    if (all.length === 0) return;
    const focused = all.find((el) => el === document.activeElement);
    const remembered = all.find((el) => el.dataset.rovingCurrent === "true");
    const first = entry ? all.find((el) => el.matches(entry)) : undefined;
    mark(focused ?? remembered ?? first ?? all[0], all);
  });

  function onFocus(event: FocusEvent<HTMLElement>) {
    const all = items();
    const target = event.target as HTMLElement;
    if (all.includes(target)) mark(target, all);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const all = items();
    const index = all.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = Math.min(all.length - 1, index + 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = all.length - 1;
    if (next === null || next === index) return;
    event.preventDefault();
    const target = all[next];
    mark(target, all);
    target.focus();
    if (activateOnMove) target.click();
  }

  return { onFocus, onKeyDown };
}
