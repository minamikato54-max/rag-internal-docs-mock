import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Chat } from "@/components/chat";
import { getAllowedUser } from "@/lib/auth";

// ログイン状態の確認は、リクエストのたびに行う。確認できるまでは「読み込み中」を見せる
async function AuthGate() {
  await connection(); // ログイン確認は、作り置きせず、毎回その場で行う（ログインの期限の確認が時刻を使うため）
  const user = await getAllowedUser();
  if (!user) redirect("/login");
  return <Chat email={user.email ?? ""} />;
}

export default function Home() {
  return (
    <Suspense
      fallback={<p className="p-6 text-sm text-stone-500">読み込んでいます…</p>}
    >
      <AuthGate />
    </Suspense>
  );
}
