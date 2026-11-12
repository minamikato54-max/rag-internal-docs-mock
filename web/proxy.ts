import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ログインの有効期限が切れそうなとき、リクエストのたびに更新する（Supabase公式の使い方）
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const root = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!root || !key) return response;

  const supabase = createServerClient(root, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser(); // 期限が近ければ、ここで更新される
  return response;
}

export const config = {
  // 画像や静的ファイルには、かけない
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
