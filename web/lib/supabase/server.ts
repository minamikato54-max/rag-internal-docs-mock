import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// URLの末尾に /rest/v1 が付いていても、付いていなくても動くようにする
export function supabaseRootUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url)
    throw new Error("環境変数 NEXT_PUBLIC_SUPABASE_URL が設定されていません");
  return url.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
}

export function supabasePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key)
    throw new Error(
      "環境変数 NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません",
    );
  return key;
}

// ログイン状態（クッキー）を読み書きできる、サーバー側のSupabaseクライアント
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseRootUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 画面の描画中はクッキーを書けない。更新は proxy.ts が行うので、ここでは何もしない
        }
      },
    },
  });
}
