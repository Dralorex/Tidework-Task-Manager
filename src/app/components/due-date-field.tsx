"use client";

import { useRef, useState } from "react";

/** Due date field with empty placeholder and click-anywhere picker. */
export function DueDateField({
  name,
  className,
  defaultValue = "",
}: {
  name: string;
  className?: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const showPlaceholder = !value && !focused;

  function openPicker() {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      el.showPicker?.();
    } catch {
      // showPicker can throw if not triggered by a user gesture in some browsers
    }
  }

  return (
    <div
      className={`relative ${className ?? ""}`}
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
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={(e) => {
          e.stopPropagation();
          openPicker();
        }}
        aria-label="Due Date"
        className={`tide-input ${
          showPlaceholder
            ? "text-transparent [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-datetime-edit]:text-transparent"
            : "[&::-webkit-calendar-picker-indicator]:cursor-pointer"
        }`}
      />
    </div>
  );
}
