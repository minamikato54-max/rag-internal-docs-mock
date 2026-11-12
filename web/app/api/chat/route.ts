import { getAllowedUser } from "@/lib/auth";
import { askQuestion } from "@/lib/rag";

const MAX_QUESTION_LENGTH = 500;

export async function POST(request: Request) {
  // ログイン済みで、許可されたメールのユーザーだけが使える（画面を通さず直接呼ばれても、ここで止める）
  if (!(await getAllowedUser())) {
    return Response.json(
      { error: "ログインが必要です。もう一度ログインしてください。" },
      { status: 401 },
    );
  }

  let question: unknown;
  try {
    ({ question } = await request.json());
  } catch {
    return Response.json(
      { error: "質問を読み取れませんでした。" },
      { status: 400 },
    );
  }

  if (typeof question !== "string" || question.trim().length === 0) {
    return Response.json(
      { error: "質問を入力してください。" },
      { status: 400 },
    );
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json(
      { error: `質問は${MAX_QUESTION_LENGTH}文字以内で入力してください。` },
      { status: 400 },
    );
  }

  try {
    return Response.json(await askQuestion(question.trim()));
  } catch (e) {
    // 詳しい原因はサーバー側の記録にだけ残し、画面には出さない（情報の漏れを防ぐ）
    console.error(
      "[chat] 回答の作成に失敗:",
      e instanceof Error ? e.message : "不明なエラー",
    );
    return Response.json(
      {
        error:
          "回答を作成できませんでした。しばらくしてから、もう一度お試しください。",
      },
      { status: 500 },
    );
  }
}
