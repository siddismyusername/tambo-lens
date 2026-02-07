"use client";

import { useTambo, useTamboThreadList } from "@tambo-ai/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquarePlus,
  History,
  Loader2,
  Trash2,
  Check,
  X,
} from "lucide-react";

const THREAD_STORAGE_KEY = "intentboard-current-thread-id";

/**
 * Saves the current thread ID to localStorage so it survives page reloads.
 */
function saveThreadId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(THREAD_STORAGE_KEY, id);
  } else {
    localStorage.removeItem(THREAD_STORAGE_KEY);
  }
}

/**
 * Retrieves the saved thread ID from localStorage.
 */
function getSavedThreadId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(THREAD_STORAGE_KEY);
}

interface ChatHistoryPanelProps {
  collapsed?: boolean;
}

export function ChatHistoryPanel({ collapsed = false }: ChatHistoryPanelProps) {
  const {
    currentThreadId,
    switchCurrentThread,
    startNewThread,
    generateThreadName,
    thread,
  } = useTambo();

  const threadListResult = useTamboThreadList();
  const threads = threadListResult.data?.items ?? [];
  const isLoadingThreads = threadListResult.isPending;

  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const prevThreadIdRef = useRef<string | null>(null);

  // ── Restore thread from localStorage on first mount ─────────────────────
  // Wait until the thread list query has settled, then attempt to restore
  // with retries. The component registry (`componentList` inside
  // TamboRegistryProvider) is populated via a useEffect that may not have
  // flushed yet when isLoadingThreads becomes false. If switchCurrentThread
  // throws because a component isn't found, we retry after a delay to give
  // the registry state time to update.
  useEffect(() => {
    if (restoredFromStorage) return;
    if (isLoadingThreads) return;

    setRestoredFromStorage(true);

    const savedId = getSavedThreadId();
    if (!savedId || savedId === currentThreadId) return;

    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 6;

    const tryRestore = () => {
      if (cancelled) return;
      attempt++;
      const delay = attempt === 1 ? 250 : attempt * 300; // 250, 600, 900, 1200, 1500, 1800

      setTimeout(async () => {
        if (cancelled) return;
        try {
          await switchCurrentThread(savedId, true);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("not found") && attempt < maxAttempts) {
            // Component registry likely not populated yet — retry
            tryRestore();
          } else {
            console.warn(
              `Failed to restore thread after ${attempt} attempt(s):`,
              msg
            );
            saveThreadId(null);
          }
        }
      }, delay);
    };

    tryRestore();
    return () => {
      cancelled = true;
    };
  }, [restoredFromStorage, isLoadingThreads, currentThreadId, switchCurrentThread]);

  // ── Persist thread ID whenever it changes ───────────────────────────────
  useEffect(() => {
    if (currentThreadId && currentThreadId !== "placeholder") {
      saveThreadId(currentThreadId);
    }
  }, [currentThreadId]);

  // ── Auto-generate thread name after first assistant reply ───────────────
  useEffect(() => {
    if (!currentThreadId || currentThreadId === "placeholder") return;
    if (prevThreadIdRef.current === currentThreadId) return;

    // Check if thread already has a name
    const currentInList = threads.find((t) => t.id === currentThreadId);
    if (currentInList?.name) {
      prevThreadIdRef.current = currentThreadId;
      return;
    }

    // Check if we have at least one assistant message (meaning the conversation has started)
    const hasAssistantMessage = thread?.messages?.some(
      (m) => m.role === "assistant"
    );
    if (hasAssistantMessage) {
      prevThreadIdRef.current = currentThreadId;
      generateThreadName(currentThreadId).catch(() => {
        // Silently ignore name generation failures
      });
    }
  }, [currentThreadId, thread?.messages, threads, generateThreadName]);

  const handleNewChat = useCallback(() => {
    startNewThread();
    saveThreadId(null);
  }, [startNewThread]);

  const handleSwitchThread = useCallback(
    async (threadId: string) => {
      if (threadId === currentThreadId) return;
      try {
        await switchCurrentThread(threadId, true);
        saveThreadId(threadId);
      } catch {
        console.warn("Failed to switch to thread", threadId);
      }
    },
    [currentThreadId, switchCurrentThread]
  );

  // ── Collapsed view: just show the "new chat" icon ─────────────────────
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleNewChat}
          title="New Chat"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Chat History"
          disabled
        >
          <History className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ── Sort threads by updatedAt descending (most recent first) ──────────
  const sortedThreads = [...threads].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="flex flex-col gap-1">
      {/* New Chat button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 h-8 text-xs"
        onClick={handleNewChat}
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        New Chat
      </Button>

      <Separator className="my-1" />

      {/* Thread list header */}
      <div className="flex items-center gap-1 px-1">
        <History className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          History
        </span>
        {isLoadingThreads && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
        )}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto max-h-[200px] space-y-0.5">
        {sortedThreads.length === 0 && !isLoadingThreads && (
          <p className="text-xs text-muted-foreground px-2 py-2">
            No conversations yet
          </p>
        )}

        {sortedThreads.map((t) => {
          const isActive = t.id === currentThreadId;
          const displayName =
            t.name || formatThreadDate(t.createdAt);

          return (
            <button
              key={t.id}
              onClick={() => handleSwitchThread(t.id)}
              className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors truncate ${
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
              title={displayName}
            >
              {displayName}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Format a date string as a human-readable short label */
function formatThreadDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Untitled chat";
  }
}
