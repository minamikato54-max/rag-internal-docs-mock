"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Source = {
  document: string;
  pages: string;
  heading: string;
  label: string;
};
type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; sources: Source[] }
  | { role: "error"; text: string };

const EXAMPLES = [
  "在宅勤務手当はいくらですか？",
  "経費精算の締め日と振込日はいつですか？",
  "PCを紛失したら、どうすればいいですか？",
];

export function Chat({ email }: { email: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (res.status === 401) {
        router.push("/login"); // ログインの有効期限が切れたときは、ログイン画面へ
        return;
      }
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "回答を作成できませんでした。");
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.answer, sources: data.sources },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "error",
          text:
            e instanceof Error
              ? e.message
              : "通信に失敗しました。もう一度お試しください。",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4">
      <header className="py-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-bold text-stone-800">社内文書検索</h1>
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span className="max-w-[12rem] truncate">{email}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-stone-600 hover:bg-stone-100"
            >
              ログアウト
            </button>
          </div>
        </div>
        <p className="text-sm text-stone-500">
          社内の規程・マニュアルに、質問できます。回答には、出典（文書名とページ）が付きます。
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto pb-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-3 text-sm text-stone-700">
              たとえば、次のように聞いてみてください。
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-amber-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-stone-800 px-4 py-2.5 text-sm text-white">
                {m.text}
              </p>
            </div>
          ) : m.role === "error" ? (
            <p
              key={i}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800"
            >
              {m.text}
            </p>
          ) : (
            <div key={i} className="max-w-[92%] space-y-2">
              <p className="whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-stone-200 bg-white px-4 py-3 text-sm leading-relaxed text-stone-800">
                {m.text}
              </p>
              {m.sources.length > 0 && (
                <ul className="space-y-1 pl-1">
                  {m.sources.map((s) => (
                    <li key={s.label} className="text-xs text-stone-500">
                      <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                        出典
                      </span>
                      {s.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
        )}

        {loading && (
          <p className="pl-1 text-sm text-stone-500">回答を作っています…</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-stone-200 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // 日本語の変換を確定するEnterでは、送信しない
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          maxLength={500}
          placeholder="質問を入力（Enterで送信、Shift＋Enterで改行）"
          className="flex-1 resize-none rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        <button
          type="submit"
          disabled={loading || input.trim().length === 0}
          className="rounded-xl bg-stone-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          送信
        </button>
      </form>
    </div>
  );
}
