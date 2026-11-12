-- 質問の「数字（ベクトル）」に近い順に、区切りを探す関数（上位N件）
create or replace function public.match_chunks(
  query_embedding extensions.vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  file_name text,
  heading text,
  page_number int,
  page_end int,
  content text,
  similarity float
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.id,
    c.document_id,
    d.file_name,
    c.heading,
    c.page_number,
    c.page_end,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- サーバー側（secret key）だけが呼べるようにする。画面側のキーでは呼べない
revoke execute on function public.match_chunks(extensions.vector, int) from public, anon, authenticated;
grant execute on function public.match_chunks(extensions.vector, int) to service_role;
