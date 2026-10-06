# Configuração de Servidores

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-INF-002 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

## Frontend estático

Publicar a raiz com `frontend/` e a configuração pública gerada. `_headers` exige revalidação para evitar clientes presos em versões antigas. Nunca publicar `.env`, chaves secretas, scripts administrativos ou artefatos temporários.

## Supabase

- aplicar schema completo somente em banco vazio;
- aplicar apenas migrations ausentes em banco existente;
- manter JWT obrigatório nas Edge Functions expostas;
- cadastrar secrets no ambiente da função;
- revisar grants, RLS e advisors após DDL;
- separar beta, homologação e produção quando houver dados reais.

## Desenvolvimento

Executar por HTTP, não `file://`. Gerar a configuração pública com `npm --prefix backend run env:sync`. Consulte [Instalação](../../getting-started/instalacao.md) e [Supabase](../../getting-started/supabase.md).

## Ambientes e segregação

Desenvolvimento usa dados sintéticos e pode executar em servidor HTTP local. Homologação deve reproduzir políticas, migrations e funções da produção sem reutilizar usuários ou dados pessoais reais. Produção recebe somente versões aprovadas e identificáveis. Nenhum ambiente inferior pode compartilhar service role, token de deploy ou secret de integração com produção.

## Configuração do frontend

A configuração pública contém apenas URL do projeto e chave publicável. Cabeçalhos de segurança e cache ficam versionados; páginas HTML devem revalidar, enquanto assets imutáveis podem usar cache longo. Rotas precisam funcionar por caminho direto, recarga e navegação interna. Antes da publicação, a auditoria verifica referências locais, dependências CDN, arquivos temporários e exposição acidental de `.env`.

## Configuração de banco e funções

Migrations são aplicadas em ordem, com registro de versão e resultado. Alterações destrutivas exigem backup, estratégia de compatibilidade e reversão possível. Funções devem validar JWT, papel, vínculo e entrada; secrets são cadastrados pelo provedor e nunca incorporados ao bundle. CORS deve listar origens necessárias em vez de liberar indiscriminadamente operações privilegiadas.

## Mudança e verificação

Toda alteração informa solicitante, ambiente, impacto, janela e plano de rollback. A validação inclui login, consulta permitida e negada por RLS, invocação de função, upload quando aplicável e inspeção de console/rede. Mudanças emergenciais seguem o mesmo registro, podendo receber revisão posterior em até um dia útil.

## Recuperação

Se a configuração divergir, interromper novas promoções, preservar logs, restaurar a última configuração conhecida e repetir smoke tests. Não corrigir produção manualmente sem registrar a mudança equivalente no repositório, pois isso impede reprodução e auditoria.
