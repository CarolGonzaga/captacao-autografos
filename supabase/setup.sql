-- Preparação para o projeto udekyeuvfjaypwzdrfsj.
-- Revisar as políticas existentes antes de executar em um banco já utilizado.
-- O bucket público permite abrir o link da imagem enviado pelo WhatsApp.
-- Visitantes podem criar arquivos, mas não listar, substituir ou apagar.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('autografos', 'autografos', true, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "autografos_public_insert"
on storage.objects for insert to anon
with check (
  bucket_id = 'autografos'
  and name ~ '^signatures/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg)$'
  and length(btrim(coalesce(user_metadata->>'author_name', ''))) between 1 and 100
  and user_metadata->>'submission_mode' in ('draw', 'upload')
);

commit;
