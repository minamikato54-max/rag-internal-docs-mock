"""テスト質問の採点（2-6a）。

- 正式な12問（materials/test/case3-test-questions.csv）＋ 言い換えの質問を、実際に流す
- 自動で見るのは3点：①答えのある質問は「見つかりません」でないこと ②答えに目印の語が入っていること ③出典の文書が正しいこと
- 答えの中身が正しいかは、結果の一覧を人が読んで確かめる（自動判定は、ことばの違いに弱いため）

使い方（案件フォルダで）:
    python -X utf8 -I -W ignore ingest/evaluate.py
"""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from answer import NOT_FOUND, answer  # noqa: E402

CSV_PATH = Path(__file__).resolve().parent.parent / "materials" / "test" / "case3-test-questions.csv"

# 正式12問の「答えに入っているはずの語」（金額のカンマは外して比べる）
KEYWORDS = {
    "1": ["6ヶ月", "10日"],
    "2": ["末", "25日"],  # 質問は「締め日と振込日」。「翌月10日までに申請」は申請期限で、質問にない
    "3": ["3日"],
    "4": ["12文字", "90日"],
    "5": ["3000"],
    "6": ["5000"],
    "7": ["情報システム部", "30分"],
    "8": ["11:00", "15:00"],
    "9": ["2営業日"],
    "10": ["45時間", "360時間"],
}

# 言い換え・別の言い方の質問（質問, 出典の文書名の一部, 答えに入るはずの語）
PARAPHRASE = [
    ("有給は何日もらえますか？", "doc1", ["10日"]),
    ("年休の申請は、何日前までにすればいいですか？", "doc1", ["3営業日"]),
    ("残業は月に何時間までOKですか？", "doc1", ["45時間"]),
    ("在宅は週に何日できますか？", "doc4", ["3日"]),
    ("出張で新幹線を使いたいときは？", "doc2", ["事前"]),
    ("会社の備品を10万円以上で買いたいときの手続きは？", "doc2", ["稟議"]),
    ("セキュリティ事故が起きたら、誰に連絡すればいい？", "doc3", ["情報システム部"]),
    ("辞めた人のアカウントは、いつ使えなくなりますか？", "doc3", ["翌営業日"]),
    ("パスワードは何文字以上ですか？", "doc3", ["12文字"]),
    ("接待費の上限はいくらですか？", "doc2", ["5000"]),
    ("新入社員には、どんなアカウントが配られますか？", "doc5", ["Google Workspace", "Slack"]),
    ("副業したいときは、どうすればいいですか？", "doc1", ["許可"]),
    ("家から会社のシステムに入るときの決まりは？", "doc4", ["VPN"]),
    ("本を買ったとき、会社は補助してくれますか？", "doc2", ["1万円"]),
    ("昼休みは何時から何時までですか？", "doc1", ["12:00", "13:00"]),
    ("退職したいときは、いつまでに伝えればいいですか？", "doc1", ["30日"]),
    ("USBメモリは使ってもいいですか？", "doc3", ["禁止"]),
    ("交通手当はいくらですか？", "doc2", None),  # 文書には「交通費」の規程のみ。どう答えるかを観察する（採点しない）
]
NOT_IN_DOCS = [
    "育児休業の取得条件を教えてください。",
    "退職金はいくらもらえますか？",
    "社長の名前を教えてください。",
    "海外出張の日当はいくらですか？",
]


def load_official() -> list[dict]:
    rows = list(csv.reader(open(CSV_PATH, encoding="utf-8-sig")))[1:]
    items = []
    for r in rows:
        # 金額のカンマで列がずれる行があるため、後ろの3列（出典文書・出典セクション・種別）から読む
        items.append({"no": r[0], "question": r[1], "doc": r[-3], "none": r[-3].startswith("（")})
    return items


def check(result: dict, doc_hint: str | None, keywords: list[str] | None) -> list[str]:
    problems = []
    text = result["answer"].replace(",", "").replace("，", "")
    if result["answer"] == NOT_FOUND:
        return ["答えがあるのに「見つかりません」と答えた"]
    for kw in keywords or []:
        if kw not in text:
            problems.append(f"答えに「{kw}」がない")
    if doc_hint:
        hints = [h.strip() for h in doc_hint.split("/")]
        cited = " ".join(s["file_name"] for s in result["sources"])
        if not any(h in cited for h in hints):
            problems.append(f"出典に {doc_hint} がない（出典：{cited or 'なし'}）")
    return problems


def main() -> None:
    ng = 0
    total = 0

    print("=== 正式な12問 ===")
    for it in load_official():
        res = answer(it["question"])
        total += 1
        if it["none"]:
            ok = res["answer"] == NOT_FOUND and not res["sources"]
            problems = [] if ok else ["記載なしの質問に、回答を作った"]
        else:
            problems = check(res, it["doc"].replace("case3-", ""), KEYWORDS.get(it["no"]))
        ng += bool(problems)
        print(f"{'OK' if not problems else 'NG'} Q{it['no']} {it['question']}\n   → {res['answer'][:90]}")
        for s in res["sources"]:
            print(f"   出典: {s['label']}")
        for p in problems:
            print(f"   ★ {p}")

    print("\n=== 言い換えの質問 ===")
    for q, doc, kws in PARAPHRASE:
        res = answer(q)
        if kws is None:
            print(f"-- 観察 {q}\n   → {res['answer'][:90]}")
            for s in res["sources"]:
                print(f"   出典: {s['label']}")
            continue
        total += 1
        problems = check(res, doc, kws)
        ng += bool(problems)
        print(f"{'OK' if not problems else 'NG'} {q}\n   → {res['answer'][:90]}")
        for p in problems:
            print(f"   ★ {p}")

    print("\n=== 記載なし（追加） ===")
    for q in NOT_IN_DOCS:
        res = answer(q)
        total += 1
        ok = res["answer"] == NOT_FOUND
        ng += (not ok)
        print(f"{'OK' if ok else 'NG'} {q}\n   → {res['answer'][:90]}")

    print(f"\n結果：{total - ng}/{total} 問が自動チェックを通過（NG {ng}）")


if __name__ == "__main__":
    main()
