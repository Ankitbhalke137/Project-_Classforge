"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DropdownItem {
  key: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  onSelect: () => void;
}

export function Dropdown({
  trigger,
  items,
  label,
  align = "right",
}: {
  trigger: ReactNode;
  items: DropdownItem[];
  label: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Clicking anywhere else, or pressing Escape, closes the menu.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {trigger}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={cn(
            "absolute z-40 mt-2 min-w-56 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-line",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-ink hover:bg-page"
            >
              {item.icon}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{item.label}</span>
                {item.description ? (
                  <span className="block truncate text-xs text-body">{item.description}</span>
                ) : null}
              </span>
              {item.trailing}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}