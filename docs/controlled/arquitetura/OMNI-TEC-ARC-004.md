# Decisões Técnicas

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-ARC-004 |
| Versão | v1.0 |
| Status | Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Criação / revisão | 2026-09-25 |

## Registro de decisões

| ADR | Data | Decisão | Estado | Consequência principal |
| --- | --- | --- | --- | --- |
| ADR-001 | 2026-09-09 | Supabase como autenticação, banco e autorização | Aceita | RLS e migrations tornam-se obrigatórios |
| ADR-002 | 2026-09-09 | Frontend principal sem framework ou build | Aceita | deploy simples, maior disciplina em caminhos e scripts |
| ADR-003 | 2026-09-09 | `professor_turma_materias` como vínculo canônico | Aceita | módulos legados precisam sincronização |
| ADR-004 | 2026-09-09 | Motor unificado de atividades por formatos | Aceita | questões, gabaritos, versões e tentativas usam contrato comum |
| ADR-005 | 2026-09-09 | Copiloto atrás de Edge Function e feature flag | Aceita | nenhuma publicação automática e secrets fora do cliente |
| ADR-006 | 2026-09-25 | Engine de trabalhos como aplicação separada | Aceita | experimentação sem quebrar o frontend estável |
| ADR-007 | 2026-09-25 | Governança automática do schema | Aceita | migrations ausentes, RLS e referências inválidas falham no check |

## Processo

Uma nova decisão registra contexto, alternativas consideradas, escolha, impactos, plano de reversão e documentos afetados. Alterações incompatíveis não substituem silenciosamente uma decisão aceita; criam uma nova ADR e marcam a anterior como substituída.

O histórico detalhado anterior permanece em [decisões legadas](../../legacy/decisoes-arquiteturais.md).

## Estrutura de uma ADR

Cada decisão nova contém: identificador, título, data, estado, responsáveis,
contexto, problema, forças relevantes, alternativas, decisão, consequências
positivas, consequências negativas, riscos, plano de implantação, reversão,
verificação e documentos afetados. O texto explica por que a escolha foi adequada no
momento, sem apagar as limitações.

## Estados

- **Proposta:** em análise e ainda sem força normativa.
- **Aceita:** orienta novas implementações.
- **Substituída:** preservada, mas outra ADR define o padrão atual.
- **Rejeitada:** avaliada e não adotada.
- **Obsoleta:** contexto deixou de existir sem decisão substituta.

## Critérios de decisão

Segurança e integridade têm precedência sobre conveniência do cliente. Depois vêm
compatibilidade com dados existentes, experiência do usuário, simplicidade
operacional, custo, desempenho e capacidade de reversão. Uma tecnologia nova deve
resolver um problema observado, ter responsável, processo de atualização e teste.

## Detalhamento das decisões vigentes

**ADR-001 e ADR-003.** Supabase centraliza identidade e persistência, mas a
autorização pedagógica pertence ao PostgreSQL. O vínculo professor-turma-matéria
evita inferir acesso apenas pelo tipo do professor ou por rotas da interface.

**ADR-002.** O frontend principal permanece estático para reduzir o processo de
deploy. A consequência é duplicação potencial e dependências CDN; por isso auditoria
de referências e componentes compartilhados são obrigatórios.

**ADR-004.** Um motor comum representa diferentes formatos de questão, mantendo
gabarito protegido e versão publicada. Especialidades docentes podem personalizar a
experiência sem criar bancos incompatíveis.

**ADR-005.** O Copiloto apenas sugere conteúdo. A Edge Function reduz dados, aplica
limites e nunca recebe autoridade para publicar, corrigir ou alterar nota.

**ADR-006.** A engine separada permite explorar trabalhos interativos com React e
Vite. A integração futura depende de um contrato com o motor canônico, não de acesso
direto improvisado às tabelas.

**ADR-007.** O schema consolidado é gerado de fontes versionadas. Checks verificam
migrations, RLS e referências do cliente, reduzindo deriva entre código e banco.

## Aprovação e revisão

O responsável técnico propõe e registra. Gestão participa quando houver custo,
tratamento de dados, disponibilidade ou mudança de escopo. Segurança revisa limites
de confiança. A ADR é revisada após incidente relevante, mudança de provedor ou
evidência de que suas premissas não se sustentam.
