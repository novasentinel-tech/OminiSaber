# Ambientes e deploy

## Objetivo

Impedir que testes da Fase 3 afetem o banco usado pelos beta-testers e deixar claro
qual configuração pertence a cada implantação.

## Ambiente Supabase atual

| Ambiente | Project ref            | Uso permitido                       |
| -------- | ---------------------- | ----------------------------------- |
| Testes   | `mvnuhwlnbhijjlosmnfv` | Testes funcionais, Copiloto e dados sintéticos |

Em 25 de setembro de 2026, a Data API do projeto de testes respondeu com a chave
administrativa configurada. O estado DDL completo não foi reconsultado porque não
há conexão PostgreSQL ou token da Management API disponível neste ambiente. O
O Copiloto usa este ambiente com habilitação controlada por flag e conta piloto.

## Arquivos locais

- `.env`: ambiente usado pelo frontend beta atual.
- `.env.phase3`: arquivo histórico do ambiente removido; não usar como destino.
- `.env.example`: contrato de variáveis, sem valores.
- `backend/ominisaber-supabase-config.js`: somente URL e chave pública geradas para
  o navegador.
- `backend/supabase/.env.example`: secrets esperados pelas Edge Functions.

Arquivos `.env` são ignorados pelo Git. Eles não devem ser copiados para a pasta
publicada nem anexados a relatórios.

## Matriz de chaves

| Variável                    | Navegador                | Servidor/Edge Function | Observação                       |
| --------------------------- | ------------------------ | ---------------------- | -------------------------------- |
| `SUPABASE_URL`              | Sim                      | Sim                    | Não é segredo                    |
| `SUPABASE_PUBLISHABLE_KEY`  | Sim                      | Opcional               | Preferida para clientes públicos |
| `SUPABASE_ANON_KEY`         | Sim, por compatibilidade | Sim                    | Chave pública legada             |
| `SUPABASE_SECRET_KEY`       | Nunca                    | Sim                    | Acesso elevado; ignora RLS       |
| `SUPABASE_SERVICE_ROLE_KEY` | Nunca                    | Somente legado         | Acesso elevado; ignora RLS       |
| `GEMINI_API_KEY`            | Nunca                    | Somente Edge Function  | Não deve chegar ao frontend      |

## Preparação local

Para usar o beta:

1. mantenha `.env` com o projeto beta;
2. execute `npm --prefix backend run env:sync`;
3. confirme que o arquivo público gerado aponta para o project ref do beta;
4. sirva o repositório por HTTP.

Não reutilize `.env.phase3` nem sobrescreva a configuração pública dos testadores
sem revisar o ambiente de destino.

## Deploy estático

O frontend não possui etapa de build. A raiz publicada precisa conter `frontend/`
e `backend/ominisaber-supabase-config.js`. Antes de cada deploy:

1. escolha explicitamente o ambiente;
2. gere a configuração pública com a URL e a publishable key corretas;
3. confirme que nenhuma chave secreta aparece no artefato;
4. execute as verificações do módulo alterado;
5. abra login, uma rota protegida e o fluxo principal em desktop e celular.

Para Netlify, use contextos ou sites separados quando a configuração do Supabase for
diferente. O deploy dos testadores deve continuar apontando para o ambiente atual
até uma decisão explícita de promoção da Fase 3.

## Deploy do banco

- Banco novo: execute o schema completo uma vez.
- Banco existente: aplique apenas migrations ainda ausentes, em ordem cronológica.
- Edge Functions: publique no mesmo projeto indicado pelo ambiente escolhido.
- Secrets: cadastre pelo painel ou CLI do Supabase; nunca escreva valores nos SQLs.
- Alterações DDL devem ser migrations versionadas e revisáveis.
- A migration `20260925090000_organizacao_governanca_banco.sql` está pronta e
  validada localmente, mas permanece pendente no remoto até uma conexão DDL ser
  autorizada.

## Promoção da Fase 3

A Fase 3 só pode chegar ao beta depois de aceite funcional e de segurança. A ordem
recomendada é: migration, Edge Function, secrets, conta piloto na feature flag,
teste controlado, monitoramento e ampliação gradual. O flag global deve permanecer
desligado no primeiro ciclo.
