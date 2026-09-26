"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";

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
  inputClassName = "rowgon-input text-sm",
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
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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
    setMounted(true);
  }, []);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const place = useCallback(() => {
    const input = inputRef.current;
    const panel = panelRef.current;
    if (!input || !panel) return;
    const rect = input.getBoundingClientRect();
    const panelHeight = panel.offsetHeight || 0;
    const gap = 4;
    let top = rect.bottom + gap;
    if (
      top + panelHeight > window.innerHeight - 8 &&
      rect.top > panelHeight + gap
    ) {
      top = rect.top - panelHeight - gap;
    }
    setCoords({
      top,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    place();
    const onReposition = () => place();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, place, filtered.length, value, clearOptionLabel]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
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

  // Phone “Done” / check dismisses the keyboard via blur — close the menu then.
  // Delay so tapping a suggestion (mousedown → click) still registers first.
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (blurCloseTimer.current) clearTimeout(blurCloseTimer.current);
    };
  }, []);

  function scheduleCloseOnBlur() {
    if (blurCloseTimer.current) clearTimeout(blurCloseTimer.current);
    blurCloseTimer.current = setTimeout(() => {
      blurCloseTimer.current = null;
      if (pickingRef.current) return;
      if (document.activeElement === inputRef.current) return;
      setOpen(false);
    }, 160);
  }

  function cancelBlurClose() {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
  }
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
        place();
      });
      return;
    }

    const next = [...head, tag].join(", ");
    commit(next, Boolean(submitOnPick));
  }

  const listMaxHeight = `${MAX_VISIBLE_SUGGESTIONS * SUGGESTION_ROW_REM}rem`;

  const dropdown =
    mounted && open
      ? createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            className="fixed z-[200] overflow-hidden rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--menu-bg)] py-1 shadow-lg"
            style={{
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              width: coords?.width ?? undefined,
              visibility: coords ? "visible" : "hidden",
            }}
          >
            {clearOptionLabel && value.trim() ? (
              <button
                type="button"
                role="option"
                className="block w-full px-3 py-1.5 text-left text-xs text-[#0A3D45]/60 hover:bg-[#0A3D45]/[0.06]"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickingRef.current = true;
                  cancelBlurClose();
                }}
                onClick={() => {
                  pickingRef.current = false;
                  commit("", Boolean(submitOnPick));
                }}
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
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickingRef.current = true;
                        cancelBlurClose();
                      }}
                      onClick={() => {
                        pickingRef.current = false;
                        pickSuggestion(tag);
                      }}
                    >
                      {tag}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

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
          onFocus={() => {
            cancelBlurClose();
            setOpen(true);
          }}
          onClick={() => setOpen(true)}
          onBlur={scheduleCloseOnBlur}
        />
      </div>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-[#0A3D45]/55">{hint}</p>
      ) : null}
      {dropdown}
    </div>
  );
}
