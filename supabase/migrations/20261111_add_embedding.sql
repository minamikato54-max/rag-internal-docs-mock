-- 検索用の数字（OpenAI text-embedding-3-small、長さ1536）を入れる列と、近い順に探すための索引
alter table public.chunks
  add column embedding extensions.vector(1536);

create index chunks_embedding_idx
  on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops);
