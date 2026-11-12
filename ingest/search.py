"""質問に近い区切りを、上位N件探して表示する（検索の動作確認用）。

使い方（案件フォルダで）:
    python -X utf8 -I -W ignore ingest/search.py "在宅勤務手当はいくら？"
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from ingest import ENV_PATH, embed, http_json, load_env  # noqa: E402


def search(question: str, top_k: int = 5) -> list[dict]:
    env = load_env(ENV_PATH)
    root = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/").removesuffix("/rest/v1")
    vector = embed([question], env["OPENAI_API_KEY"])[0]
    return http_json(
        root + "/rest/v1/rpc/match_chunks",
        {"apikey": env["SUPABASE_SERVICE_ROLE_KEY"], "Content-Type": "application/json"},
        {"query_embedding": "[" + ",".join(str(x) for x in vector) + "]", "match_count": top_k},
    )


if __name__ == "__main__":
    question = sys.argv[1]
    print(f"質問: {question}")
    for rank, r in enumerate(search(question), start=1):
        pages = (
            f"p.{r['page_number']}"
            if r["page_number"] == r["page_end"]
            else f"p.{r['page_number']}-{r['page_end']}"
        )
        print(f"{rank}. 類似度{r['similarity']:.3f}  {r['file_name']} {pages}  {r['heading']}")
