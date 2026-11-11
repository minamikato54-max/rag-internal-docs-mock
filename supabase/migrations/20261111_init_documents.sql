-- 社内文書検索AI(RAG) 初期スキーマ（検索用ベクトル列は、変換サービス選定後に追加する）
create extension if not exists vector with schema extensions;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  title text,
  uploaded_at timestamptz not null default now()
);

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  page_number int,
  chunk_index int not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index chunks_document_id_idx on public.chunks(document_id);

-- 利用者の画面（anonキー）から直接読み書きさせない。サーバー側（service role）だけが扱う
alter table public.documents enable row level security;
alter table public.chunks enable row level security;
