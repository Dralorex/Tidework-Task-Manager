"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import {
  loadFloatingChatListAction,
  loadFloatingChatThreadAction,
  type FloatingChatSummary,
  type FloatingChatThread,
} from "@/app/actions/floating-chat";
import { sendMessageAction } from "@/app/actions/social";
import { MarkChatSeen } from "@/app/components/mark-chat-seen";

const STORAGE_KEY = "tidework.chat.widget";

type WidgetPrefs = {
  open: boolean;
  lastGroupId: string | null;
};

function readPrefs(): WidgetPrefs {
  if (typeof window === "undefined") {
    return { open: false, lastGroupId: null };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { open: false, lastGroupId: null };
    const parsed = JSON.parse(raw) as Partial<WidgetPrefs>;
    return {
      open: Boolean(parsed.open),
      lastGroupId:
        typeof parsed.lastGroupId === "string" ? parsed.lastGroupId : null,
    };
  } catch {
    return { open: false, lastGroupId: null };
  }
}

function writePrefs(prefs: WidgetPrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / private mode */
  }
}

function kindLabel(kind: FloatingChatSummary["kind"]) {
  if (kind === "dm") return "DM";
  if (kind === "workspace") return "Workspace";
  return "Group";
}

export function FloatingChatWidget({
  chatUnreadCount = 0,
}: {
  chatUnreadCount?: number;
}) {
  const pathname = usePathname();
  const hideOnChatPage = pathname.startsWith("/app/chat");

  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastGroupId, setLastGroupId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "thread">("list");
  const [chats, setChats] = useState<FloatingChatSummary[]>([]);
  const [thread, setThread] = useState<FloatingChatThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const prefsRef = useRef<WidgetPrefs>({ open: false, lastGroupId: null });

  useEffect(() => {
    const prefs = readPrefs();
    prefsRef.current = prefs;
    setOpen(prefs.open);
    setLastGroupId(prefs.lastGroupId);
    if (prefs.open && prefs.lastGroupId) {
      setView("thread");
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: Partial<WidgetPrefs>) => {
    const merged: WidgetPrefs = {
      open: next.open ?? prefsRef.current.open,
      lastGroupId:
        next.lastGroupId !== undefined
          ? next.lastGroupId
          : prefsRef.current.lastGroupId,
    };
    prefsRef.current = merged;
    writePrefs(merged);
    if (next.open !== undefined) setOpen(merged.open);
    if (next.lastGroupId !== undefined) setLastGroupId(merged.lastGroupId);
  }, []);

  const refreshList = useCallback(async () => {
    const result = await loadFloatingChatListAction();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setChats(result.chats);
  }, []);

  const openThread = useCallback(
    async (groupId: string) => {
      setError(null);
      const result = await loadFloatingChatThreadAction(groupId);
      if (!result.ok) {
        setError(result.error);
        setView("list");
        setThread(null);
        return;
      }
      setThread(result.thread);
      setView("thread");
      persist({ lastGroupId: groupId });
      setDraft("");
    },
    [persist],
  );

  // Load list / last thread when panel opens.
  useEffect(() => {
    if (!ready || !open || hideOnChatPage) return;

    startTransition(() => {
      void (async () => {
        await refreshList();
        if (view === "thread" && lastGroupId) {
          await openThread(lastGroupId);
        }
      })();
    });
    // Only when open/ready flips — intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, open, hideOnChatPage]);

  // Soft-poll thread + list while open so messages stay fresh across tabs.
  useEffect(() => {
    if (!ready || !open || hideOnChatPage) return;
    const id = window.setInterval(() => {
      void refreshList();
      if (view === "thread" && (thread?.id || lastGroupId)) {
        void loadFloatingChatThreadAction(thread?.id ?? lastGroupId!).then(
          (result) => {
            if (result.ok) setThread(result.thread);
          },
        );
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [
    ready,
    open,
    hideOnChatPage,
    view,
    thread?.id,
    lastGroupId,
    refreshList,
  ]);

  useEffect(() => {
    if (view !== "thread") return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [view, thread?.messages.length]);

  if (!ready || hideOnChatPage) return null;

  const toggleOpen = () => {
    const next = !open;
    persist({ open: next });
    if (next && lastGroupId) {
      setView("thread");
    } else if (next) {
      setView("list");
    }
  };

  const closePanel = () => {
    persist({ open: false });
  };

  const backToList = () => {
    setView("list");
    setThread(null);
    void refreshList();
  };

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread || thread.closed || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("groupId", thread.id);
      fd.set("body", draft.trim());
      const result = await sendMessageAction(null, fd);
      if (!result?.ok) {
        setError(result && "error" in result ? result.error : "Send failed.");
        return;
      }
      setDraft("");
      await openThread(thread.id);
      await refreshList();
    } finally {
      setSending(false);
    }
  };

  const badge =
    chatUnreadCount > 0
      ? chatUnreadCount > 99
        ? "99+"
        : String(chatUnreadCount)
      : null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div
          className="pointer-events-auto flex h-[min(34rem,calc(100vh-6.5rem))] w-[min(22.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[#0A3D45]/12 bg-[rgba(255,255,255,0.92)] shadow-[0_18px_50px_rgba(10,61,69,0.18)] backdrop-blur-md animate-[tide-rise_220ms_ease]"
          role="dialog"
          aria-label="Chat"
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#0A3D45]/10 px-3 py-2.5">
            <div className="min-w-0">
              {view === "thread" && thread ? (
                <button
                  type="button"
                  onClick={backToList}
                  className="text-left text-xs text-[#0A3D45]/60 hover:underline"
                >
                  ← All chats
                </button>
              ) : (
                <p className="text-xs font-medium uppercase tracking-wide text-[#0A3D45]/50">
                  Chats
                </p>
              )}
              <h2 className="truncate font-[family-name:var(--font-display)] text-lg text-[#0A3D45]">
                {view === "thread" && thread ? thread.title : "Messages"}
              </h2>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-full px-2.5 py-1 text-lg leading-none text-[#0A3D45]/55 hover:bg-[#0A3D45]/8 hover:text-[#0A3D45]"
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          {error ? (
            <p className="shrink-0 px-3 py-2 text-sm text-[#9b2f22]">{error}</p>
          ) : null}

          {view === "list" ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {pending && chats.length === 0 ? (
                <p className="px-3 py-4 text-sm text-[#0A3D45]/55">Loading…</p>
              ) : null}
              <ul className="divide-y divide-[#0A3D45]/8">
                {chats.map((chat) => (
                  <li key={chat.id}>
                    <button
                      type="button"
                      onClick={() => {
                        startTransition(() => {
                          void openThread(chat.id);
                        });
                      }}
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-[#0A3D45]/[0.04]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-[#0A3D45]">
                            {chat.title}
                          </span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-[#0A3D45]/40">
                            {kindLabel(chat.kind)}
                          </span>
                          {chat.closed ? (
                            <span className="shrink-0 text-[10px] uppercase tracking-wide text-[#0A3D45]/40">
                              Closed
                            </span>
                          ) : null}
                          {chat.unread > 0 ? (
                            <span className="rounded-full bg-[#E85D4C] px-1.5 text-[10px] font-semibold leading-4 text-white">
                              {chat.unread > 99 ? "99+" : chat.unread}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[#0A3D45]/55">
                          {chat.snippet}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              {!pending && chats.length === 0 ? (
                <p className="px-3 py-4 text-sm text-[#0A3D45]/55">
                  No chats yet. Open the Chat tab to start one.
                </p>
              ) : null}
            </div>
          ) : null}

          {view === "thread" && thread ? (
            <>
              <MarkChatSeen groupId={thread.id} />
              <p className="shrink-0 truncate px-3 pt-2 text-[11px] text-[#0A3D45]/45">
                {thread.membersLabel}
                {thread.closed ? " · closed" : ""}
              </p>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-2">
                {thread.messages.map((msg) => (
                  <div key={msg.id} className="text-sm">
                    <span className="font-semibold text-[#0A3D45]">
                      {msg.mine ? "You" : msg.senderLabel}
                    </span>{" "}
                    <span className="text-[11px] text-[#0A3D45]/45">
                      {format(new Date(msg.createdAt), "MMM d · HH:mm")}
                    </span>
                    <p className="whitespace-pre-wrap text-[#0A3D45]/80">
                      {msg.body}
                    </p>
                  </div>
                ))}
                {thread.messages.length === 0 ? (
                  <p className="text-sm text-[#0A3D45]/55">No messages yet.</p>
                ) : null}
                <div ref={messagesEndRef} />
              </div>
              <div className="shrink-0 border-t border-[#0A3D45]/10 px-3 py-2.5">
                {thread.closed ? (
                  <p className="rounded-md bg-[#0A3D45]/[0.05] px-2.5 py-2 text-xs text-[#0A3D45]/70">
                    This chat was closed. You can still read it here.
                  </p>
                ) : (
                  <form className="flex gap-2" onSubmit={onSend}>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Write a message…"
                      className="tide-input flex-1 !py-2 text-sm"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="tide-btn-secondary !px-3 !py-2 text-sm disabled:opacity-60"
                    >
                      {sending ? "…" : "Send"}
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : null}

          {view === "thread" && !thread && pending ? (
            <p className="px-3 py-4 text-sm text-[#0A3D45]/55">Loading chat…</p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggleOpen}
        className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-[#0A3D45] text-[#E8F7F6] shadow-[0_12px_32px_rgba(10,61,69,0.28)] transition hover:scale-[1.04] hover:bg-[#1A7A82] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3DBEAB]"
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
      >
        {open ? (
          <span className="text-2xl leading-none" aria-hidden>
            ×
          </span>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v7.5a2.25 2.25 0 0 1-2.25 2.25H10.5L6 19.5v-2.25H6.75A2.25 2.25 0 0 1 4.5 15V6.75Z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <path
              d="M8.25 9.75h7.5M8.25 12.75h5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        )}
        {!open && badge ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.25rem] rounded-full bg-[#E85D4C] px-1 text-center text-[11px] font-semibold leading-5 text-white">
            {badge}
          </span>
        ) : null}
      </button>
    </div>
  );
}
