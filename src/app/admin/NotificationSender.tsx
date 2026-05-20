"use client";

import { useState } from "react";
import { sendNotification } from "@/app/actions";

export default function NotificationSender() {
  const [title, setTitle] = useState("IT'S STATIC");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setStatus(null);
    try {
      const result = await sendNotification(body, { title, url });
      if (result.success) {
        setStatus({ ok: true, msg: `Sent to ${result.sent} subscriber(s)` });
        setBody("");
      } else {
        setStatus({ ok: false, msg: result.error ?? "Failed" });
      }
    } catch {
      setStatus({ ok: false, msg: "Server error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-surface border-4 border-on-background shadow-[8px_8px_0px_0px_#1b1b1e] p-8 flex flex-col gap-6">
      <h1 className="font-display-lg text-2xl uppercase text-on-background">
        Push Notifications
      </h1>

      <form onSubmit={handleSend} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-label-lg text-sm text-on-surface-variant uppercase">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-2 border-on-background p-3 font-body-md text-on-background bg-surface-container focus:outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-label-lg text-sm text-on-surface-variant uppercase">Message *</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={3}
            placeholder="New drop incoming..."
            className="border-2 border-on-background p-3 font-body-md text-on-background bg-surface-container focus:outline-none focus:border-primary resize-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-label-lg text-sm text-on-surface-variant uppercase">Link URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/"
            className="border-2 border-on-background p-3 font-body-md text-on-background bg-surface-container focus:outline-none focus:border-primary"
          />
        </label>

        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="bg-primary text-on-primary font-label-lg uppercase px-6 py-3 border-2 border-on-background shadow-[4px_4px_0px_0px_#1b1b1e] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#1b1b1e] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Sending…" : "Send to all subscribers"}
        </button>
      </form>

      {status && (
        <p className={`font-label-lg text-sm ${status.ok ? "text-secondary" : "text-error"}`}>
          {status.ok ? "✓ " : "✗ "}{status.msg}
        </p>
      )}

      <p className="font-label-sm text-xs text-on-surface-variant">
        Only users who clicked &quot;Get notified&quot; will receive this.
      </p>
    </div>
  );
}
