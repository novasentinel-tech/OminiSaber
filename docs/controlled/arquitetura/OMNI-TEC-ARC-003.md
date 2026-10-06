# Padrões Arquiteturais Adotados

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-ARC-003 |
| Versão | v1.0 |
| Status | Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Criação / revisão | 2026-09-25 |

## Padrões vigentes

1. **Frontend modular por papel e jornada.** Cada área possui rotas e estilos próprios; comportamento comum fica em componentes compartilhados.
2. **Banco como barreira de segurança.** RLS, grants, constraints e triggers protegem os dados mesmo quando o cliente falha.
3. **Migrações aditivas.** Bancos existentes recebem apenas migrations pendentes. Instalações novas usam o schema consolidado gerado.
4. **Vínculo docente canônico.** `professor_turma_materias` define autorização por professor, turma e disciplina; estruturas legadas servem apenas à compatibilidade.
5. **Operações compostas por RPC.** Publicar, entregar, corrigir ou ajustar nota usa transação quando várias tabelas precisam permanecer coerentes.
6. **Evidência imutável.** Versões publicadas, auditorias e ajustes preservam histórico em vez de sobrescrevê-lo.
7. **Integrações atrás de Edge Functions.** APIs privadas e secrets não chegam ao navegador.
8. **Documentação como contrato.** Documentos controlados definem regras; auditorias e imagens servem como evidência datada.

## Exceções conhecidas

O frontend principal ainda carrega o SDK Supabase por CDN em várias páginas e não possui bundler. A pasta `engine/` utiliza Vite e React por ser uma aplicação separada. Exceções novas exigem registro em [Decisões Técnicas](OMNI-TEC-ARC-004.md).

## Critérios de aplicação

| Situação | Padrão obrigatório | Evidência esperada |
| --- | --- | --- |
| nova tabela pública | RLS, grants mínimos, PK, FKs e índices | migration e teste permitido/negado |
| operação com várias gravações | RPC transacional | rollback testado e erro tratável |
| integração com segredo | Edge Function | secret fora do cliente e JWT validado |
| mudança incompatível | ADR e plano de migração | decisão, impacto e reversão |
| novo layout | mobile first e componentes compartilhados | auditoria em celular e desktop |
| dado para evolução | evidência corrigida no banco | origem, fórmula e estado vazio |

## Padrões de dados

Entidades usam nomes `snake_case`, chaves UUID e timestamps com fuso. Estados
possuem enum ou `check` quando o conjunto é fechado. JSONB é reservado a conteúdo
variável com contrato validado; campos consultados frequentemente permanecem em
colunas tipadas. FKs declaram comportamento de exclusão e recebem índice adequado.
Views expostas devem usar `security_invoker` para respeitar RLS.

## Padrões de autorização

Policies separam leitura, inserção, atualização e exclusão quando isso melhora a
clareza. Atualizações exigem `USING` e `WITH CHECK`, além de policy de leitura.
Funções `security definer` são exceção: schema não exposto, `search_path` vazio,
objetos qualificados, validação da sessão e execução revogada de papéis não
autorizados. `user_metadata` não concede papéis; o perfil e os vínculos controlados
pelo sistema definem autorização.

## Padrões de interface

Componentes interativos têm rótulo acessível, foco visível e alvo de toque. Ícones
usam SVG ou biblioteca carregada de forma confiável, nunca texto de fallback como
se fosse o ícone. Barras fixas respeitam safe areas. Modais preservam foco,
fechamento explícito e rolagem interna. Estados de carregamento não escondem erros.

## Governança de exceções

Uma exceção informa motivo, alcance, prazo, responsável, risco e critério para
remoção. A exceção não altera o padrão geral e entra no registro de débito técnico.
Na revisão, a equipe confirma se o desvio ainda é necessário ou se deve virar uma
nova decisão arquitetural.
