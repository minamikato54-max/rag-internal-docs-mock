-- 出典表示用：見出しと、ページの範囲（1〜2ページにまたがる章に対応）
alter table public.chunks
  add column heading text,
  add column page_end int;
