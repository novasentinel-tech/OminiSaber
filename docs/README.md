# Documentação do OminiSaber

Este é o índice da documentação técnica e operacional vigente. Documentos em
`legacy/` são históricos e não substituem os contratos descritos aqui.

## Controle documental

- [Controle de formulários e documentos técnicos](governance/controle-de-formularios.md)
- 28 documentos canônicos seguem o cadastro `OMNI-FRM-000-002`, com código,
  versão, status, classificação, público e responsável.
- Guias de módulos detalham implementação; auditorias datadas guardam evidências;
  documentos em `legacy/` servem somente como histórico.

## Estado atual

- [Status do projeto e fases](development/status-do-projeto.md)
- [Ambientes e deploy](development/ambientes-e-deploy.md)
- [Problemas conhecidos](development/known-issues.md)
- [Auditoria geral de 9 de setembro de 2026](development/auditoria-sistema-2026-09-09.md)
- [Features implementadas](controlled/desenvolvimento/OMNI-TEC-DEV-003.md)
- [Débito técnico](controlled/desenvolvimento/OMNI-TEC-DEV-004.md)
- [Indicadores de qualidade](controlled/testes/OMNI-TEC-TST-004.md)

## Primeiros passos

- [Instalação](getting-started/instalacao.md)
- [Configuração e variáveis de ambiente](getting-started/configuracao.md)
- [Instalação e atualização do Supabase](getting-started/supabase.md)

## Arquitetura

- [Visão geral e decisões](architecture/visao-geral.md)
- [Frontend](architecture/frontend.md)
- [Backend](architecture/backend.md)
- [Autenticação](architecture/autenticacao.md)
- [Permissões e RLS](architecture/permissoes-rls.md)
- [Fluxo de dados](architecture/fluxo-de-dados.md)
- [Fluxogramas do sistema](architecture/fluxogramas.md)
- [Databook Client-Side](client-side-databook.md)

## Banco de dados

- [Schema](database/schema.md)
- [Tabelas](database/tabelas.md)
- [Relacionamentos](database/relacionamentos.md)
- [Migrations](database/migrations.md)
- [Policies RLS](database/rls-policies.md)
- [Convenções](database/convencoes.md)

## Módulos

- [Motor de atividades — Fases 2.1 a 2.4](modules/motor-atividades/README.md)
- [Copiloto docente — Fase 3.0](modules/copiloto-docente/README.md)
- [Aluno](modules/aluno/README.md)
- [Professor](modules/professor/README.md)
- [Professor de Matemática](modules/professor-matematica/README.md)
- [Professor de Português](modules/professor-portugues/README.md)
- [Redações](modules/redacoes/README.md)
- [Avaliações](modules/avaliacoes/README.md)
- [Agenda](modules/agenda/README.md)
- [Biblioteca](modules/biblioteca/README.md)
- [Gestão](modules/administracao/README.md)
- [Catálogo curricular da base comum](modules/catalogo-curricular-base-comum.md)
- [Importação curricular](modules/importacao-curricular.md)

## Guias de usuário

- [Aluno](user-guides/aluno.md)
- [Professor](user-guides/professor.md)
- [Professor de Matemática](user-guides/professor-matematica.md)
- [Professor de Português](user-guides/professor-portugues.md)
- [Gestor](user-guides/administrador.md)

## Desenvolvimento, segurança e design

- [Design system](design/design-system.md)
- [Padrão de seletores — aluno e professor](design/seletores-aluno-professor.md)
- [Estrutura de pastas](development/estrutura-de-pastas.md)
- [Convenções de código](development/convencoes-de-codigo.md)
- [Cliente Supabase](development/supabase-client.md)
- [Checklist de desenvolvimento](development/checklist-de-desenvolvimento.md)
- [Debugging](development/debugging.md)
- [Troubleshooting](development/troubleshooting.md)
- [Política de segurança](security/security-policy-pt-br.md)
- [Design system](design/design-system.md)

## Histórico

Consulte [documentos legados](legacy/README.md) apenas para contexto de decisões e
protótipos anteriores.
