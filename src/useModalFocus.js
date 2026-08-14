import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export const focusableWithin = (root) => (root
  ? [...root.querySelectorAll(FOCUSABLE)].filter((element) => (
    element.offsetWidth > 0 || element.offsetHeight > 0 || element === document.activeElement
  ))
  : []);

// Every overlay in this prototype declares role="dialog" aria-modal="true". That
// attribute tells a screen reader that everything outside the dialog does not exist,
// so if focus is allowed to leave, the user lands on controls their screen reader
// refuses to read and has no way back. This hook makes the markup's promise true:
// focus moves in on open, is trapped while open, returns to whatever opened the
// dialog on close, and the rest of the app is made inert so neither the keyboard nor
// assistive technology can reach it.
//
// Pass onEscape only for dialogs the player is genuinely allowed to dismiss. The
// Command Seal decision, the workshop, and the debrief all require a choice, so they
// deliberately do not close on Escape.
export function useModalFocus(isOpen, { onEscape } = {}) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return undefined;

    returnFocusRef.current = document.activeElement;

    const siblings = [...(dialog.parentElement?.children ?? [])].filter((element) => element !== dialog);
    const inerted = siblings.filter((element) => !element.hasAttribute("inert"));
    inerted.forEach((element) => element.setAttribute("inert", ""));

    const initial = focusableWithin(dialog)[0] ?? dialog;
    if (initial === dialog && !dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
    initial.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape" && escapeRef.current) {
        event.preventDefault();
        escapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableWithin(dialog);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const outside = !dialog.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      inerted.forEach((element) => element.removeAttribute("inert"));
      const target = returnFocusRef.current;
      if (target && typeof target.focus === "function" && document.contains(target)) target.focus();
    };
  }, [isOpen]);

  return dialogRef;
}
