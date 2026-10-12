"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icons";

const SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = "md",
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes, and the page behind must not scroll.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${SIZES[size]} rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/** A Modal pre-wired for a yes/no question. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  isPending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isPending?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isPending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}