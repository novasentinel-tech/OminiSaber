# Configuração e variáveis de ambiente

## Arquivos

| Arquivo                                 | Finalidade                                    | Pode ir ao Git?                           |
| --------------------------------------- | --------------------------------------------- | ----------------------------------------- |
| `.env.example`                          | Modelo sem valores                            | Sim                                       |
| `.env`                                  | Ambiente beta/local selecionado               | Não                                       |
| `.env.phase3`                           | Histórico do projeto removido; não reutilizar | Não                                       |
| `backend/ominisaber-supabase-config.js` | URL e chave pública consumidas pelo browser   | Sim, se contiver somente valores públicos |
| `backend/supabase/.env.example`         | Contrato das Edge Functions                   | Sim                                       |

## Variáveis

| Variável                    | Uso                                         |
| --------------------------- | ------------------------------------------- |
| `SUPABASE_URL`              | URL pública do projeto                      |
| `SUPABASE_PUBLISHABLE_KEY`  | Chave recomendada para browser              |
| `SUPABASE_ANON_KEY`         | Compatibilidade com projetos legados        |
| `SUPABASE_SECRET_KEY`       | Scripts ou funções de servidor              |
| `SUPABASE_SERVICE_ROLE_KEY` | Compatibilidade administrativa legada       |
| `SUPABASE_JWKS_URL`         | Validação de assinatura quando necessária   |
| `APP_ORIGIN`                | Origem local permitida                      |
| `GEMINI_API_KEY`            | Somente secret da Edge Function do Copiloto |
| `GEMINI_MODEL`              | Modelo Google usado pela Edge Function      |
| `ALLOWED_ORIGINS`           | Lista de origens aceitas pela Edge Function |

## Gerar a configuração pública

```powershell
npm --prefix backend run env:sync
```

O script copia somente URL e publishable/anon key. Se uma secret key aparecer em
HTML, JavaScript público, documentação ou commit, trate como incidente: remova,
revogue e gere outra chave.

## Escolher o ambiente

Não troque o projeto implicitamente. Confira o project ref antes de gerar a
configuração. O ambiente de testes e o estado não implantado da Fase 3 estão descritos em
[Ambientes e deploy](../development/ambientes-e-deploy.md).

## Edge Functions

Secrets de `gestor-contas`, `curriculo-upload` e `professor-copiloto` são
configurados no projeto Supabase de destino. Arquivos `.env` locais servem ao
desenvolvimento e não substituem os secrets remotos.
