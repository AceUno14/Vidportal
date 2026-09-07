"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function FormDialog({ label, busy, onClose, onSubmit, children }: {
  label: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="modal ui-dialog"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form aria-busy={busy} onSubmit={(event) => {
        event.preventDefault();
        if (!busy) void onSubmit();
      }}>
        <fieldset disabled={busy}>{children}</fieldset>
      </form>
    </dialog>
  );
}
