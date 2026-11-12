import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// メールのリンクを押したあと、ここに戻ってくる。ログインを完了させて、トップページへ
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=1`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !isAllowedEmail(data.user?.email)) {
    await supabase.auth.signOut(); // 許可されていないメールなら、ログイン状態を取り消す
    return NextResponse.redirect(`${origin}/login?error=1`);
  }
  return NextResponse.redirect(`${origin}/`);
}
