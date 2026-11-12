"""PDFを「見出しごと」の区切り（チャンク）に分ける。

- ページをまたぐ章は1つにまとめ、出典用に page_start / page_end を持つ
- PDFの折り返しで途中切れした文は、つなぎ直す
- 各チャンクの先頭に「文書名＞見出し」を付ける（検索で、どの文書の何の話か分かるように）
- 表は 2-2c で対処する（ここでは、1マスずつ1行のまま残す）
"""

import re
import sys
from pathlib import Path

import pymupdf

# 見出し：「第1章 …」または「1. …」（短く、文末の「。」がない行だけ）
CHAPTER_RE = re.compile(r"^第\d+章\s*\S")
NUMBERED_RE = re.compile(r"^\d+\.\s*\S")
NOISE_RE = re.compile(r"^本書は RAG")  # 取り込み用サンプルであることを示す注記（検索に不要）
# 行の右端が、そのページの右端（最大）にほぼ届いている行は、折り返された行とみなす（単位：pt）
WRAP_TOLERANCE = 3.0


def is_heading(line: str) -> bool:
    if CHAPTER_RE.match(line):
        return True
    return bool(NUMBERED_RE.match(line)) and not line.endswith("。") and len(line) <= 25


def group_rows(cells: list[tuple[float, float, str]], tolerance: float = 4.0) -> list[list[str]]:
    """(縦の位置, 横の位置, 文字) を、同じ高さごとに行にまとめ、左から順に並べる。"""
    rows: list[list[tuple[float, float, str]]] = []
    for cell in sorted(cells):
        if rows and abs(cell[0] - rows[-1][0][0]) <= tolerance:
            rows[-1].append(cell)
        else:
            rows.append([cell])
    return [[text for _, _, text in sorted(row, key=lambda c: c[1])] for row in rows]


def table_to_lines(rows: list[list[str | None]]) -> list[str]:
    """表を「列名=値／列名=値」の1行ずつに直す（行と列の対応を、文字のまま残すため）。"""
    cleaned = [[(c or "").replace("\n", "").strip() for c in row] for row in rows]
    cleaned = [r for r in cleaned if any(r)]
    if len(cleaned) < 2:
        return ["／".join(c for r in cleaned for c in r if c)] if cleaned else []
    header, body = cleaned[0], cleaned[1:]
    return ["／".join(f"{h}={v}" for h, v in zip(header, row) if v) for row in body]


def read_lines(pdf_path: Path) -> list[tuple[int, str, bool]]:
    """(ページ番号, 行, 折り返された行か) の一覧を返す。ページ番号は1から。表は行ごとの文に直す。"""
    result = []
    with pymupdf.open(pdf_path) as doc:
        for page_no, page in enumerate(doc, start=1):
            tables = page.find_tables().tables
            table_boxes = [pymupdf.Rect(t.bbox) for t in tables]
            entries = []  # (縦の位置, 行, 右端の位置, 表の行か)
            cells_in_table = [[] for _ in table_boxes]  # 表ごとの (縦の位置, 横の位置, 文字)
            for block in page.get_text("dict")["blocks"]:
                for ln in block.get("lines", []):
                    text = "".join(span["text"] for span in ln["spans"]).strip()
                    if not text or NOISE_RE.match(text):
                        continue
                    box = pymupdf.Rect(ln["bbox"])
                    in_table = False
                    for idx, tb in enumerate(table_boxes):
                        if tb.intersects(box) and (box & tb).get_area() > 0.5 * box.get_area():
                            # 表の中の文字は、元の文字のまま集めて、あとで行と列に並べ直す
                            cells_in_table[idx].append((ln["bbox"][1], ln["bbox"][0], text))
                            in_table = True
                            break
                    if not in_table:
                        entries.append((ln["bbox"][1], text, ln["bbox"][2], False))
            right_edge = max((x1 for _, _, x1, _ in entries), default=0)
            for tb, cells in zip(table_boxes, cells_in_table):
                for k, row_text in enumerate(table_to_lines(group_rows(cells))):
                    entries.append((tb.y0 + k * 0.001, row_text, 0.0, True))
            for _, text, x1, is_table in sorted(entries, key=lambda e: e[0]):
                result.append((page_no, text, (not is_table) and x1 >= right_edge - WRAP_TOLERANCE))
    return result


def join_wrapped(lines: list[tuple[int, str, bool]]) -> list[tuple[int, int, str]]:
    """折り返しで途中切れした行をつなぐ。(開始ページ, 終了ページ, 文) を返す。"""
    merged: list[list] = []
    prev_wrapped = False
    for page_no, line, wrapped in lines:
        if (
            merged
            and prev_wrapped
            and not merged[-1][2].endswith("。")
            and not is_heading(line)
            and not is_heading(merged[-1][2])
        ):
            merged[-1][1] = page_no
            merged[-1][2] += line
        else:
            merged.append([page_no, page_no, line])
        prev_wrapped = wrapped
    return [(a, b, t) for a, b, t in merged]


def chunk_pdf(pdf_path: Path) -> list[dict]:
    lines = read_lines(pdf_path)
    if not lines:
        return []
    title = lines[0][1]  # 1行目は文書名
    meta_line = lines[1][1] if len(lines) > 1 else ""  # 会社名・改定日・管轄
    body = join_wrapped(lines[2:])

    sections: list[dict] = []
    current = None
    for page_start, page_end, text in body:
        if is_heading(text):
            current = {"heading": text, "page_start": page_start, "page_end": page_end, "lines": []}
            sections.append(current)
        else:
            if current is None:  # 見出しの前の本文（今回の素材にはない）
                current = {"heading": "", "page_start": page_start, "page_end": page_end, "lines": []}
                sections.append(current)
            current["lines"].append(text)
            current["page_end"] = max(current["page_end"], page_end)

    chunks = []
    for i, sec in enumerate(sections):
        content = "\n".join(sec["lines"])
        header = f"{title}＞{sec['heading']}" if sec["heading"] else title
        chunks.append(
            {
                "file_name": pdf_path.name,
                "title": title,
                "meta": meta_line,
                "heading": sec["heading"],
                "page_start": sec["page_start"],
                "page_end": sec["page_end"],
                "chunk_index": i,
                "content": f"{header}\n{content}",
            }
        )
    return chunks


if __name__ == "__main__":
    # 使い方: python -I -W ignore chunker.py <PDFのあるフォルダ>
    folder = Path(sys.argv[1])
    for pdf in sorted(folder.glob("*.pdf")):
        for c in chunk_pdf(pdf):
            pages = (
                f"p.{c['page_start']}"
                if c["page_start"] == c["page_end"]
                else f"p.{c['page_start']}-{c['page_end']}"
            )
            print(f"\n[{pdf.name}] #{c['chunk_index']} {pages} ({len(c['content'])}文字)")
            print(c["content"])
