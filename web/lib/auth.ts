import { createClient } from "@/lib/supabase/server";

// 許可するメールは、.env.local で指定する（カンマ区切り）。どちらも未設定なら、全員を拒否する（安全側）
//   ALLOWED_EMAIL_DOMAINS=techbridge.co.jp        … 会社のドメインごと許可
//   ALLOWED_EMAILS=a@example.com,b@example.com    … 個別のアドレスを許可（テスト用）
function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 1) return false;
  const domain = normalized.slice(at + 1);
  const domains = parseList(process.env.ALLOWED_EMAIL_DOMAINS);
  const emails = parseList(process.env.ALLOWED_EMAILS);
  return domains.includes(domain) || emails.includes(normalized);
}

// ログイン済みで、許可されたメールのユーザーだけを返す。それ以外は null
export async function getAllowedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser(); // サーバーに問い合わせて確かめる（クッキーの中身は信用しない）
  if (error || !data.user || !isAllowedEmail(data.user.email)) return null;
  return data.user;
}
