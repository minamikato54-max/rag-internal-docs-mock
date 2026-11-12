"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

// メールのリンクが無効だったとき（期限切れ・許可されていないメールなど）
const LINK_ERROR =
  "ログインできませんでした。リンクの期限が切れているか、このメールアドレスは利用できません。もう一度お試しください。";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const linkFailed = useSearchParams().get("error") !== null;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shownError = error ?? (linkFailed && !message ? LINK_ERROR : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "送信できませんでした。");
      else setMessage(data.message);
    } catch {
      setError("通信に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-stone-800">社内文書検索</h1>
        <p className="mt-1 text-sm text-stone-500">
          会社のメールアドレスを入力してください。ログイン用のリンクをお送りします（パスワードは不要です）。
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label
            className="block text-sm font-medium text-stone-700"
            htmlFor="email"
          >
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.co.jp"
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          <button
            type="submit"
            disabled={loading || email.trim().length === 0}
            className="w-full rounded-xl bg-stone-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {loading ? "送信しています…" : "ログイン用のリンクを送る"}
          </button>
        </form>

        {message && (
          <p
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-stone-700"
            role="status"
          >
            {message}
          </p>
        )}
        {shownError && (
          <p
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
            role="alert"
          >
            {shownError}
          </p>
        )}
      </div>
    </main>
  );
}
