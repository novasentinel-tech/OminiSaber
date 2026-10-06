# Pré-deploy Netlify — 30 de setembro de 2026

## Resultado

O projeto está preparado para deploy conectado ao repositório usando `netlify.toml`.

## Processo de build

1. `npm --prefix engine ci`
2. `npm --prefix engine run build`
3. `node scripts/prepare-netlify-site.mjs`
4. publicação exclusiva da pasta `netlify-dist`

## Conteúdo público permitido

- `index.html`
- `frontend/`
- cliente compilado do OmniStudio em `oministudio/` e uma cópia de compatibilidade em `engine/dist/client/`
- clientes públicos do Supabase em `backend/`
- service worker, manifesto, `_headers` e `_redirects`

Não entram no pacote publicado:

- `.env` e `.env.phase3`
- chaves `service_role`, secrets do Supabase ou chaves privadas de provedores de IA, incluindo Gemini
- migrations e schemas SQL
- scripts administrativos
- testes, documentação ou `node_modules`

O arquivo `backend/ominisaber-supabase-config.js` contém somente URL e chave publicável, apropriadas para uso no navegador. Autorização continua sendo aplicada pelas políticas RLS do Supabase.

## Rotas

- `/oministudio`
- `/oministudio/*`

As duas rotas são reescritas para `/oministudio/index.html`. O mesmo aplicativo existe fisicamente nessa pasta, portanto o deploy manual de `netlify-dist` não depende do `netlify.toml` externo. Os assets compilados usam caminhos relativos e ficam disponíveis em `/oministudio/assets/`.

A cópia em `/engine/dist/client/` permanece como endereço canônico dos links do professor e por compatibilidade com favoritos antigos. `/oministudio/` funciona como endereço curto alternativo.

## Verificações executadas

- build Vite de produção concluído;
- pacote `netlify-dist` gerado;
- arquivos essenciais encontrados;
- nenhuma chave privada encontrada no pacote;
- 10/10 testes gerais aprovados;
- 5/5 testes do empacotamento do OmniStudio aprovados;
- contrato Supabase do aluno e RLS validados anteriormente com conta autenticada.

## Formas de publicação

- Deploy conectado ao Git: usar normalmente; a Netlify lerá `netlify.toml`.
- Deploy manual por arrastar e soltar: gere novamente o pacote e envie o conteúdo da pasta `netlify-dist`, nunca uma versão antiga nem a raiz do projeto. Confirme antes do envio que `netlify-dist/oministudio/index.html` existe.
