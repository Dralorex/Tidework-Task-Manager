"use client";

import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";

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
  submitOnPick = false,
  clearOptionLabel,
}: {
  tags: string[];
  name?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  emptyMessage?: string;
  /** When true, picking a tag submits the parent form (for GET filters). */
  submitOnPick?: boolean;
  clearOptionLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const query = value.trim().toLowerCase();
  const filtered = query
    ? tags.filter((t) => t.toLowerCase().includes(query))
    : tags;

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
    setValue(next);
    setOpen(false);
    if (!submit) return;
    requestAnimationFrame(() => {
      inputRef.current?.form?.requestSubmit();
    });
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
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
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] max-h-56 overflow-y-auto rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--menu-bg)] py-1 shadow-lg"
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
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[#0A3D45]/55">
              {tags.length === 0 ? emptyMessage : "No matching tags"}
            </p>
          ) : (
            filtered.map((tag) => {
              const selected = tag.toLowerCase() === query;
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
                  onClick={() => commit(tag, Boolean(submitOnPick))}
                >
                  {tag}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
