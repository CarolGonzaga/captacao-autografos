# Captação de autógrafos — Lendo Sáficos

Site estático com desenho ou upload de assinaturas. A adaptação local utiliza
Supabase Storage e mantém a confirmação manual pelo WhatsApp.

## Estado da configuração

- Projeto de destino: `udekyeuvfjaypwzdrfsj`.
- A chave pública está preenchida em `supabase-config.js`.
- A política de `supabase/setup.sql` foi aplicada manualmente e confirmada pela usuária.
- Integração real verificada: upload PNG, leitura pública e recusa de envios sem autora.

## Ativação

1. Conectar a conta Supabase que contém o projeto de destino.
2. Inspecionar os buckets e políticas existentes. Em um projeto vazio, executar
   `supabase/setup.sql` no SQL Editor uma vez. O script não modifica buckets
   existentes; se `autografos` já existir, conferir suas configurações.
3. Copiar a **publishable key** do projeto para `publishableKey` em
   `supabase-config.js`. O site estático serve essa configuração ao navegador;
   nunca inserir `service_role`, `sb_secret` ou senha do banco nesse arquivo.
4. Publicar os arquivos do site na Vercel pela equipe que administra o projeto.
5. Testar desenho e upload, confirmar o arquivo no Storage e abrir o link
   gerado para o WhatsApp. Conferir também a recusa de arquivos maiores que
   5 MB, outros formatos e tentativas de listar/substituir/apagar como visitante.

## Dados e acesso

O bucket `autografos` armazena cada imagem em `signatures/<uuid>.png` ou `.jpg`.
O nome da autora e o modo de envio ficam nos metadados personalizados do objeto
(`author_name` e `submission_mode`); a data fica em `created_at`. Não é criada
uma tabela separada. Esses dados podem ser consultados por administradores em
`storage.objects` no SQL Editor:

```sql
select name, created_at, user_metadata->>'author_name' as autora,
       user_metadata->>'submission_mode' as modo
from storage.objects
where bucket_id = 'autografos'
order by created_at desc;
```

As imagens são públicas para que o destinatário do WhatsApp consiga abrir o
link. Qualquer pessoa que receber esse link poderá ver a imagem. A política
permite somente novos envios anônimos, com nomes aleatórios; ela não permite
listar os objetos, sobrescrever ou excluir. Conferir outras políticas do
projeto, pois permissões adicionais podem ampliar esse acesso. O formulário
público não tem proteção contra envios automatizados.

Criar o projeto novo não recupera os arquivos antigos. A recuperação depende
do acesso ao Firebase anterior ou de cópias de segurança.

## Verificação local

Execute `node --test tests/upload.test.cjs` para os testes locais.
O comando manual `node tests/verify-storage.cjs` verifica o Storage real e
grava uma imagem de teste de 1 pixel, identificada pelo nome da autora
`TESTE DE INTEGRAÇÃO — pode remover`.

Abra o site usando um servidor HTTP estático. Sem a chave pública configurada,
o envio mostra um aviso e não apresenta sucesso. O fluxo de sucesso só aparece
após confirmação de gravação pelo Supabase.

Documentação: [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control),
[Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).
