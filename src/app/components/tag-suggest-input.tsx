"use client";

import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";

/** Approx. row height for suggestion buttons (py-1.5 + text-sm). */
const SUGGESTION_ROW_REM = 2.25;
const MAX_VISIBLE_SUGGESTIONS = 6;

/** Text input with a clickable suggestion list of existing tags. */
export function TagSuggestInput({
  tags,
  name = "name",
  placeholder = "Tag",
  defaultValue = "",
  required = false,
  className,
  inputClassName = "tide-input text-sm",
  emptyMessage = "No tags yet",
  hint,
  submitOnPick = false,
  clearOptionLabel,
  allowMultiple = false,
  keepOpenOnPick = false,
}: {
  tags: string[];
  name?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  emptyMessage?: string;
  /** Short helper under the field (e.g. comma-separated tip). */
  hint?: string;
  /** When true, picking a tag submits the parent form (for GET filters). */
  submitOnPick?: boolean;
  clearOptionLabel?: string;
  /** Allow comma-separated tags; suggestions match the last segment. */
  allowMultiple?: boolean;
  /**
   * When picking with allowMultiple, keep the menu open and append ", "
   * so another tag can be typed. Closes only if the tag is already selected.
   */
  keepOpenOnPick?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const segments = allowMultiple ? value.split(",") : [value];
  const head = allowMultiple
    ? segments
        .slice(0, -1)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const activeQuery = (segments[segments.length - 1] ?? "").trim().toLowerCase();
  const taken = new Set(head.map((s) => s.toLowerCase()));

  const filtered = tags.filter((t) => {
    const lower = t.toLowerCase();
    if (taken.has(lower)) return false;
    if (!activeQuery) return true;
    return lower.includes(activeQuery);
  });

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commit(next: string, submit: boolean) {
    flushSync(() => {
      setValue(next);
      setOpen(false);
    });
    if (submit) {
      inputRef.current?.form?.requestSubmit();
    }
  }

  function pickSuggestion(tag: string) {
    if (!allowMultiple) {
      commit(tag, Boolean(submitOnPick));
      return;
    }

    if (taken.has(tag.toLowerCase())) {
      setOpen(false);
      return;
    }

    if (keepOpenOnPick) {
      const next = `${[...head, tag].join(", ")}, `;
      setValue(next);
      setOpen(true);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
      });
      return;
    }

    const next = [...head, tag].join(", ");
    commit(next, Boolean(submitOnPick));
  }

  const listMaxHeight = `${MAX_VISIBLE_SUGGESTIONS * SUGGESTION_ROW_REM}rem`;

  return (
    <div className={className}>
      <div ref={wrapRef} className="relative">
        <input
          ref={inputRef}
          name={name}
          value={value}
          required={required}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          placeholder={placeholder}
          className={inputClassName}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
        />
        {open ? (
          <div
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] overflow-hidden rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--menu-bg)] py-1 shadow-lg"
          >
            {clearOptionLabel && value.trim() ? (
              <button
                type="button"
                role="option"
                className="block w-full px-3 py-1.5 text-left text-xs text-[#0A3D45]/60 hover:bg-[#0A3D45]/[0.06]"
                onClick={() => commit("", Boolean(submitOnPick))}
              >
                {clearOptionLabel}
              </button>
            ) : null}
            <div className="overflow-y-auto" style={{ maxHeight: listMaxHeight }}>
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[#0A3D45]/55">
                  {tags.length === 0 ||
                  (tags.length > 0 && taken.size >= tags.length && !activeQuery)
                    ? emptyMessage
                    : activeQuery
                      ? "No matching tags"
                      : emptyMessage}
                </p>
              ) : (
                filtered.map((tag) => {
                  const selected = tag.toLowerCase() === activeQuery;
                  return (
                    <button
                      key={tag}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-[#0A3D45]/[0.06] ${
                        selected
                          ? "font-semibold text-[#0A3D45]"
                          : "text-[#0A3D45]/80"
                      }`}
                      onClick={() => pickSuggestion(tag)}
                    >
                      {tag}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-[#0A3D45]/55">{hint}</p>
      ) : null}
    </div>
  );
}
