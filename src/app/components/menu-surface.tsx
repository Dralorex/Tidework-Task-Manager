"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type Align = "left" | "right";

/**
 * Renders a dropdown into document.body with fixed positioning so it isn’t
 * clipped by overflow:hidden ancestors and stays above other UI layers.
 */
export function MenuSurface({
  open,
  onClose,
  align = "right",
  widthClass = "min-w-[10rem]",
  children,
  trigger,
}: {
  open: boolean;
  onClose: () => void;
  align?: Align;
  widthClass?: string;
  children: ReactNode;
  trigger: (opts: {
    ref: RefObject<HTMLButtonElement | null>;
  }) => ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const place = useCallback(() => {
    const btn = buttonRef.current;
    const panel = panelRef.current;
    if (!btn || !panel) return;
    const rect = btn.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || 160;
    const panelHeight = panel.offsetHeight || 0;
    const gap = 4;
    let left = align === "right" ? rect.right - panelWidth : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
    let top = rect.bottom + gap;
    if (top + panelHeight > window.innerHeight - 8 && rect.top > panelHeight + gap) {
      top = rect.top - panelHeight - gap;
    }
    setCoords({ top, left });
  }, [align]);

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
  }, [open, place, children]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      {trigger({ ref: buttonRef })}
      {mounted && open
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              className={`fixed z-[200] rounded-lg border border-[#0A3D45]/12 bg-[#E8F7F6] py-1 shadow-lg ${widthClass}`}
              style={{
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
                visibility: coords ? "visible" : "hidden",
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function menuItemClass(danger = false) {
  return danger
    ? "block w-full px-3 py-2 text-left text-sm text-[#9b2f22] hover:bg-[#E85D4C]/10"
    : "block w-full px-3 py-2 text-left text-sm text-[#0A3D45] hover:bg-[#0A3D45]/8";
}
