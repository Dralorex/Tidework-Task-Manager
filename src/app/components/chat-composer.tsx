"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/app/actions/auth";
import {
  sendMessageAction,
  setChatNotifyModeAction,
  touchChatSeenAction,
} from "@/app/actions/social";
import { highlightMentions } from "@/lib/mentions";

type MentionOption =
  | { kind: "user"; label: string; insert: string }
  | { kind: "everyone"; label: string; insert: string }
  | { kind: "role"; label: string; insert: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="tide-btn-primary min-h-11 text-sm disabled:opacity-60">
      {pending ? "…" : "Send"}
    </button>
  );
}

export function ChatMessageBody({ body }: { body: string }) {
  const parts = highlightMentions(body);
  return (
    <p className="text-[#0A3D45]/80">
      {parts.map((part, i) =>
        part.isMention ? (
          <span key={i} className="font-semibold text-[#1a7a82]">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

export function ChatComposer({
  groupId,
  options,
  notifyMode,
}: {
  groupId: string;
  options: MentionOption[];
  notifyMode: "ALL" | "MENTIONS" | "MUTE";
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [state, formAction] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await sendMessageAction(prev, formData);
      if (result?.ok) {
        setBody("");
        setPickerOpen(false);
        router.refresh();
      }
      return result;
    },
    null,
  );

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, filter]);

  useEffect(() => {
    const form = new FormData();
    form.set("groupId", groupId);
    void touchChatSeenAction(null, form);
    const id = window.setInterval(() => {
      void touchChatSeenAction(null, form);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [groupId]);

  function onChange(value: string) {
    setBody(value);
    const cursor = inputRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const at = before.lastIndexOf("@");
    if (at >= 0 && !/\s/.test(before.slice(at + 1))) {
      setFilter(before.slice(at + 1));
      setPickerOpen(true);
    } else {
      setPickerOpen(false);
      setFilter("");
    }
  }

  function insertMention(insert: string) {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? body.length;
    const before = body.slice(0, cursor);
    const after = body.slice(cursor);
    const at = before.lastIndexOf("@");
    if (at < 0) return;
    const next = `${before.slice(0, at)}${insert} ${after}`;
    setBody(next);
    setPickerOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = at + insert.length + 1;
      el?.setSelectionRange(pos, pos);
    });
  }

  const [notifyState, notifyAction] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await setChatNotifyModeAction(prev, formData);
      if (result?.ok) router.refresh();
      return result;
    },
    null,
  );

  return (
    <div className="mt-4 space-y-3">
      <form action={formAction} className="relative flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="groupId" value={groupId} />
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={inputRef}
            name="body"
            required
            rows={2}
            value={body}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write a message… use @ to mention"
            className="tide-input min-h-[3.25rem] w-full"
          />
          {pickerOpen && filtered.length > 0 ? (
            <ul className="absolute bottom-full left-0 z-10 mb-1 max-h-40 w-full overflow-y-auto rounded-xl border border-[#0A3D45]/15 bg-white p-1 shadow-lg">
              {filtered.map((opt) => (
                <li key={`${opt.kind}:${opt.insert}`}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#0A3D45] hover:bg-[#0A3D45]/8"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(opt.insert);
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <SubmitButton />
      </form>
      {state && !state.ok ? (
        <p className="text-sm text-[#9b2f22]">{state.error}</p>
      ) : null}

      <form action={notifyAction} className="flex flex-wrap items-center gap-2 text-xs text-[#0A3D45]/65">
        <input type="hidden" name="groupId" value={groupId} />
        <span className="font-semibold">Alerts:</span>
        {(
          [
            ["ALL", "All messages"],
            ["MENTIONS", "Mentions only"],
            ["MUTE", "Mute"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="submit"
            name="mode"
            value={mode}
            className={`rounded-full px-2.5 py-1 font-semibold ${
              notifyMode === mode
                ? "bg-[#0A3D45] text-[#E8F7F6]"
                : "bg-white/60 hover:bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </form>
      {notifyState && !notifyState.ok ? (
        <p className="text-sm text-[#9b2f22]">{notifyState.error}</p>
      ) : null}
    </div>
  );
}
