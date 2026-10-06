# Inventário de Infraestrutura

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-INF-001 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

| Recurso | Finalidade | Configuração controlada | Dados críticos |
| --- | --- | --- | --- |
| Hospedagem estática / Netlify | publicar frontend | raiz do repositório, `_headers` e config pública | não deve conter secrets |
| Supabase Auth | identidade e sessão | projeto por ambiente | usuários e credenciais gerenciadas |
| Supabase PostgreSQL | dados e autorização | schema, migrations, RLS e grants | dados escolares e auditoria |
| Supabase Edge Functions | operações privilegiadas | `backend/supabase/functions` | secrets e integrações |
| Supabase Storage | materiais e biblioteca | buckets e policies | arquivos pedagógicos |
| Estação de desenvolvimento | edição e verificações | Node.js 22+, Python e servidor HTTP | `.env` local |
| Engine | autoria interativa | Vite/React, build próprio | protótipos e contratos de trabalho |

O inventário registra componentes lógicos, não credenciais, endereços privados ou chaves. Ambientes estão em [Ambientes e deploy](../../development/ambientes-e-deploy.md).

## Objetivo e abrangência

Este documento identifica os recursos necessários para desenvolver, homologar e operar o OminiSaber. O inventário cobre serviços gerenciados, componentes implantáveis, estações autorizadas e dependências que podem afetar disponibilidade, segurança ou continuidade. Recursos pessoais, ambientes temporários e integrações experimentais também devem ser registrados antes de receberem dados reais.

## Critérios de inventário

Cada recurso precisa ter proprietário técnico, ambiente, finalidade, classificação dos dados, configuração reproduzível e dependências conhecidas. O registro deve indicar se o componente é essencial para login, publicação, entrega, correção ou recuperação. Identificadores públicos podem ser referenciados; credenciais, chaves e URLs administrativas permanecem no cofre do ambiente.

## Dependências e criticidade

O frontend depende de configuração pública válida e dos serviços Supabase. Auth e PostgreSQL são críticos porque sustentam identidade, vínculos e evidências pedagógicas. Edge Functions tornam-se críticas quando concentram uma operação privilegiada. Storage é crítico para jornadas com arquivos, mas sua indisponibilidade não deve corromper registros relacionais. A Engine possui ciclo de build próprio e só integra a produção após contrato e testes aprovados.

## Ciclo de vida

1. **Entrada:** registrar finalidade, responsável, custo, ambiente e dados antes da ativação.
2. **Mudança:** atualizar versão, configuração e dependências no mesmo pacote da alteração.
3. **Revisão:** reconciliar inventário com repositório, painel do provedor e registros de deploy trimestralmente.
4. **Desativação:** exportar evidências necessárias, revogar acessos, remover secrets e confirmar ausência de dependentes.

## Responsabilidades e evidências

O responsável técnico mantém a exatidão do inventário. A gestão aprova recursos com custo, dados pessoais ou impacto de continuidade. A evidência mínima inclui configuração versionada, registro de deploy, responsável atual e resultado da última revisão. Divergências abrem item em INF-004 quando afetam serviço ou em SEC-002 quando criam exposição.
