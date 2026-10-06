# Documentação de APIs

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-DEV-006 |
| Versão | v1.0 |
| Status | Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

## Superfícies

| Superfície | Autenticação | Contrato |
| --- | --- | --- |
| Supabase Auth | publishable key + credencial do usuário | sessão, JWT e identidade |
| Data API | JWT + grants + RLS | tabelas públicas autorizadas |
| RPCs PostgreSQL | JWT e validação interna | operações atômicas de atividade, correção e resultados |
| `gestor-contas` | JWT verificado | administração de contas por gestor autorizado |
| `curriculo-upload` | JWT verificado | upload e processamento curricular |
| `professor-copiloto` | JWT, vínculo e feature flag | sugestão pedagógica sem publicação automática |

## Regras de contrato

Erros devem ser tratáveis e não revelar existência de contas ou dados de terceiros. Operações mutáveis retornam somente dados necessários. Tabelas internas e gabaritos não são expostos. Alterações em payloads exigem compatibilidade ou versionamento.

As tabelas e relações estão em [Tabelas](../../database/tabelas.md); RPCs do motor em [Motor de atividades](../../modules/motor-atividades/README.md); cliente em [Cliente Supabase](../../development/supabase-client.md).

## Autenticação e autorização

O cliente inicia sessão pelo Auth e envia JWT automaticamente. A chave pública
identifica o projeto, mas não substitui usuário. Data API combina privilégios SQL e
RLS. Edge Functions verificam JWT e repetem checagens de papel/vínculo para operações
elevadas. `service_role` e secret key ficam fora do navegador.

## Convenções de requisição

Filtros, seleção de colunas e paginação devem ser explícitos. Relações PostgREST com
múltiplas FKs indicam a constraint. O cliente não solicita gabaritos ou colunas
administrativas. IDs são UUIDs e datas trafegam em ISO 8601. Payloads JSONB possuem
tipo/formato validado antes de persistir.

## Erros e idempotência

Erros de autenticação, autorização, validação, conflito e indisponibilidade recebem
tratamento distinto. Mensagens públicas não revelam contas ou dados de terceiros.
Operações suscetíveis a repetição verificam estado atual ou chave única. A publicação
não é considerada completa se a versão essencial falhar; efeitos auxiliares, como
notificação, precisam de reconciliação registrada.

## Evolução de contrato

Adicionar coluna opcional pode ser compatível; remover, renomear ou mudar semântica
exige migração e período de transição. Uma Edge Function alterada preserva clientes
ativos ou publica nova versão. Mudanças atualizam exemplos, testes e consumidores.

## Observabilidade e privacidade

Logs registram operação, duração, estado e identificadores técnicos mínimos. Não
registram senha, token, chave, gabarito ou texto integral de aluno sem necessidade.
O Copiloto recebe contexto reduzido e seu retorno continua sujeito à revisão humana.
