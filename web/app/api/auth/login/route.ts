import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// 許可されたメールかどうかに関わらず、同じ返事を返す（誰が許可されているかを、外から探られないため）
const SAME_REPLY = {
  message:
    "入力したメールアドレスに、ログイン用のリンクを送りました。届かない場合は、情報システム部にご連絡ください。",
};

export async function POST(request: Request) {
  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return Response.json(
      { error: "メールアドレスを読み取れませんでした。" },
      { status: 400 },
    );
  }
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return Response.json(
      { error: "メールアドレスの形式が正しくありません。" },
      { status: 400 },
    );
  }

  const address = email.trim();
  if (isAllowedEmail(address)) {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ??
      new URL(request.url).origin;
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      console.error(
        "[login] リンクの送信に失敗:",
        error.status ?? "",
        error.code ?? "",
      );
      return Response.json(
        {
          error:
            "ログイン用のリンクを送れませんでした。しばらくしてから、もう一度お試しください。",
        },
        { status: 500 },
      );
    }
  }
  return Response.json(SAME_REPLY);
}
