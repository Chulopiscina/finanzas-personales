"use client";
import { useEffect, useRef } from "react";
export function useDialogFocus(active: boolean, close: () => void) {
  const callback = useRef(close); callback.current = close;
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!root) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const elements = () => [...root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((node) => node.getClientRects().length);
    elements()[0]?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); callback.current(); }
      if (event.key !== "Tab") return;
      const list = elements(), first = list[0], last = list.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    root.addEventListener("keydown", keyboard);
    return () => { root.removeEventListener("keydown", keyboard); document.body.style.overflow = overflow; previous?.focus(); };
  }, [active]);
}
