"""PDF → 区切り → 変換（OpenAI Embedding）→ Supabaseに保存。

使い方（案件フォルダで）:
    python -X utf8 -I -W ignore ingest/ingest.py materials/docs

- キーは `.env.local` から読む（画面には出さない）
- 同じファイル名の文書は、いったん消してから入れ直す（何回実行しても重複しない）
- 保存先のRLSを通すため、サーバー側のsecret keyを使う（画面側のコードでは絶対に使わない）
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from chunker import chunk_pdf  # noqa: E402

EMBED_MODEL = "text-embedding-3-small"  # ベクトルの長さ1536
ENV_PATH = Path(__file__).resolve().parent.parent / ".env.local"


def load_env(path: Path) -> dict[str, str]:
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    return env


def http_json(url: str, headers: dict, body=None, method="POST"):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        # エラー内容だけを出す（キーを含む情報は出さない）
        detail = e.read().decode("utf-8", errors="replace")[:300]
        raise SystemExit(f"通信エラー {e.code}: {detail}") from None


def embed(texts: list[str], api_key: str) -> list[list[float]]:
    res = http_json(
        "https://api.openai.com/v1/embeddings",
        {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        {"model": EMBED_MODEL, "input": texts},
    )
    return [item["embedding"] for item in sorted(res["data"], key=lambda d: d["index"])]


def main(folder: Path) -> None:
    env = load_env(ENV_PATH)
    # URLの末尾に /rest/v1 が付いていても、付いていなくても動くようにする
    root = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/").removesuffix("/rest/v1")
    base = root + "/rest/v1"
    sb = {
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    openai_key = env["OPENAI_API_KEY"]

    total_chunks = 0
    for pdf in sorted(folder.glob("*.pdf")):
        chunks = chunk_pdf(pdf)
        if not chunks:
            print(f"スキップ（文字なし）: {pdf.name}")
            continue

        vectors = embed([c["content"] for c in chunks], openai_key)

        # 同じファイル名の文書があれば消す（区切りは連動して消える）
        http_json(f"{base}/documents?file_name=eq.{urllib.parse.quote(pdf.name)}", sb, method="DELETE")

        doc = http_json(base + "/documents", sb, {"file_name": pdf.name, "title": chunks[0]["title"]})[0]

        rows = [
            {
                "document_id": doc["id"],
                "chunk_index": c["chunk_index"],
                "heading": c["heading"],
                "page_number": c["page_start"],
                "page_end": c["page_end"],
                "content": c["content"],
                "embedding": "[" + ",".join(str(x) for x in v) + "]",
            }
            for c, v in zip(chunks, vectors)
        ]
        http_json(base + "/chunks", {**sb, "Prefer": "return=minimal"}, rows)
        total_chunks += len(rows)
        print(f"保存: {pdf.name}（{len(rows)}個）")

    print(f"完了：{total_chunks}個の区切りを保存しました")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
