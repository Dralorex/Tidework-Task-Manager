"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

function toIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function usePreferInAppPicker() {
  const [prefer, setPrefer] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px), (pointer: coarse)");
    const sync = () => setPrefer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return prefer;
}

/** Due date field with empty placeholder, Reset/Clear, and click-anywhere picker. */
export function DueDateField({
  name,
  className,
  defaultValue = "",
  blink = false,
  blinkReset = false,
  blinkClear = false,
  onFieldActivate,
  onReset,
  onClear,
  /** Coach tip rendered inside the in-app calendar sheet (phone). */
  sheetPrompt,
  onPickerOpenChange,
}: {
  name: string;
  className?: string;
  defaultValue?: string;
  blink?: boolean;
  blinkReset?: boolean;
  blinkClear?: boolean;
  onFieldActivate?: () => void;
  onReset?: () => void;
  onClear?: () => void;
  sheetPrompt?: ReactNode;
  onPickerOpenChange?: (open: boolean) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    return parseIso(defaultValue) ?? new Date();
  });
  const ref = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const preferInApp = usePreferInAppPicker();
  const showPlaceholder = !value && !focused && !sheetOpen;

  const setOpen = useCallback(
    (open: boolean) => {
      setSheetOpen(open);
      onPickerOpenChange?.(open);
    },
    [onPickerOpenChange],
  );

  function openPicker() {
    onFieldActivate?.();
    if (preferInApp) {
      const base = parseIso(value) ?? new Date();
      setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
      setOpen(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      el.showPicker?.();
    } catch {
      // showPicker can throw if not triggered by a user gesture in some browsers
    }
  }

  const days = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    const first = new Date(y, m, 1);
    const startPad = first.getDay(); // Sun=0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: ({ iso: string; day: number; inMonth: true } | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ iso: toIso(new Date(y, m, d)), day: d, inMonth: true });
    }
    return cells;
  }, [viewMonth]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, setOpen]);

  const today = todayIso();

  return (
    <div className={`min-w-0 space-y-1.5 ${className ?? ""}`}>
      <div
        className={`relative min-w-0 overflow-hidden rounded-[0.85rem] ${
          blink
            ? "animate-tide-blink-empty ring-2 ring-[#3b82f6]/45 ring-offset-1"
            : ""
        }`}
        onClick={(e) => {
          if (e.target === ref.current) return;
          openPicker();
        }}
      >
        {showPlaceholder ? (
          <span
            className="pointer-events-none absolute inset-0 z-[1] flex items-center px-[0.9rem] text-[color-mix(in_srgb,var(--tide-ink)_45%,transparent)]"
            aria-hidden
          >
            Due Date
          </span>
        ) : null}
        <input
          ref={ref}
          type="date"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => {
            setFocused(true);
            if (preferInApp) {
              // Keep native focus from opening OS picker on phone
              ref.current?.blur();
              openPicker();
              return;
            }
            onFieldActivate?.();
          }}
          onBlur={() => setFocused(false)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openPicker();
          }}
          aria-label="Due Date"
          readOnly={preferInApp}
          className={`tide-input max-w-full min-w-0 ${
            showPlaceholder
              ? "text-transparent [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-datetime-edit]:text-transparent [&::-webkit-datetime-edit]:max-w-full"
              : "[&::-webkit-calendar-picker-indicator]:cursor-pointer"
          }`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-full border border-[#0A3D45]/15 bg-white/70 px-2.5 py-1 text-xs font-semibold text-[#0A3D45]/75 hover:bg-white ${
            blinkReset
              ? "animate-tide-blink-empty ring-2 ring-[#3b82f6]/45"
              : ""
          }`}
          onClick={() => {
            setValue(todayIso());
            onReset?.();
          }}
        >
          Reset
        </button>
        <button
          type="button"
          className={`rounded-full border border-[#0A3D45]/15 bg-white/70 px-2.5 py-1 text-xs font-semibold text-[#0A3D45]/75 hover:bg-white ${
            blinkClear
              ? "animate-tide-blink-empty ring-2 ring-[#3b82f6]/45"
              : ""
          }`}
          onClick={() => {
            setValue("");
            onClear?.();
          }}
        >
          Clear
        </button>
        <span className="text-[11px] text-[#0A3D45]/50">(optional)</span>
      </div>

      {sheetOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex flex-col justify-end bg-[#0A3D45]/55 sm:items-center sm:justify-center sm:bg-[#0A3D45]/45 sm:p-4"
              role="presentation"
              onClick={() => setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={`flex w-full flex-col overflow-hidden bg-[#F3FBFA] shadow-2xl sm:max-w-md sm:rounded-2xl ${
                  sheetPrompt
                    ? "h-[min(100dvh,100%)] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl"
                    : "max-h-[92dvh] rounded-t-2xl sm:rounded-2xl"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-[#0A3D45]/10 px-4 py-3">
                  <h2
                    id={titleId}
                    className="font-[family-name:var(--font-display)] text-lg text-[#0A3D45]"
                  >
                    Due Date
                  </h2>
                  <button
                    type="button"
                    className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#0A3D45]/70 hover:bg-[#0A3D45]/8"
                    onClick={() => setOpen(false)}
                  >
                    Done
                  </button>
                </div>

                {sheetPrompt ? (
                  <div className="border-b border-[#93c5fd] bg-[#E8F1FF] px-4 py-3">
                    {sheetPrompt}
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#0A3D45]/75 hover:bg-[#0A3D45]/8"
                      onClick={() =>
                        setViewMonth(
                          (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1),
                        )
                      }
                      aria-label="Previous month"
                    >
                      ‹
                    </button>
                    <p className="text-sm font-semibold text-[#0A3D45]">
                      {monthLabel(viewMonth)}
                    </p>
                    <button
                      type="button"
                      className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#0A3D45]/75 hover:bg-[#0A3D45]/8"
                      onClick={() =>
                        setViewMonth(
                          (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1),
                        )
                      }
                      aria-label="Next month"
                    >
                      ›
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#0A3D45]/45">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (d) => (
                        <span key={d} className="py-1">
                          {d}
                        </span>
                      ),
                    )}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {days.map((cell, i) =>
                      cell ? (
                        <button
                          key={cell.iso}
                          type="button"
                          onClick={() => {
                            setValue(cell.iso);
                            onFieldActivate?.();
                            setOpen(false);
                          }}
                          className={`min-h-10 rounded-lg text-sm font-medium ${
                            cell.iso === value
                              ? "bg-[#0A3D45] text-white"
                              : cell.iso === today
                                ? "bg-[#3DBEAB]/25 text-[#0A3D45]"
                                : "text-[#0A3D45] hover:bg-[#0A3D45]/8"
                          }`}
                        >
                          {cell.day}
                        </button>
                      ) : (
                        <span key={`pad-${i}`} className="min-h-10" />
                      ),
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-[#0A3D45]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#0A3D45]/75"
                      onClick={() => {
                        const t = todayIso();
                        setValue(t);
                        onReset?.();
                        setOpen(false);
                      }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[#0A3D45]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#0A3D45]/75"
                      onClick={() => {
                        setValue("");
                        onClear?.();
                        setOpen(false);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
