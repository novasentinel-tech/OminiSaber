# Registro de Refatorações

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-DEV-007 |
| Versão | v1.0 |
| Status | Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-26 |

| Data | Escopo | Alteração | Verificação |
| --- | --- | --- | --- |
| 2026-09-09 | motor de atividades | contratos unificados para autoria, execução, correção e recuperação | verificadores de builder, aluno, revisão e resultados |
| 2026-09-23 | área do aluno | correções responsivas, ícones e agenda | auditoria visual e páginas móveis |
| 2026-09-24 | área do professor | navegação móvel, formulários e correções de layout | auditoria docente com 27 evidências |
| 2026-09-25 | banco | governança, índices de FK, diagnóstico interno e verificador de deriva | SQL, RLS, documentação e schema completo |
| 2026-09-25 | documentação | adoção do controle OMNI-FRM-000-002 | validação dos 28 documentos controlados |
| 2026-09-26 | laboratório de redação do aluno | mapa guiado e correção responsiva integrada ao shell Parties atual | matriz visual em 320, 390, 768, 1024, 1440 e desktop amplo; sidebar aberta e recolhida; sem overflow horizontal |
| 2026-09-26 | painel principal do aluno | roteamento contextual da matéria Redação diretamente ao laboratório interativo, sem passagem pelo mapa de descritores | clique simples, Enter e navegação do caderno; regressão do mapa nas demais matérias |

Novas entradas devem informar impacto funcional, arquivos, migração quando aplicável e resultado das verificações. Refatorações que mudam comportamento também atualizam features, testes e decisões técnicas.

## Classificação

- **Estrutural:** move responsabilidades ou remove duplicação sem alterar contrato.
- **Segurança:** reduz privilégio, superfície ou exposição.
- **Desempenho:** melhora consulta, carregamento ou consumo com resultado equivalente.
- **Usabilidade:** reorganiza interface preservando regra de negócio.
- **Dados:** normaliza schema ou fluxo de persistência com migração controlada.

## Procedimento

Antes da mudança, registrar motivação, comportamento atual e testes de proteção.
Durante a execução, separar alterações mecânicas das funcionais sempre que possível.
Depois, comparar fluxos, rodar checks e atualizar documentação. Se a refatoração
precisar de mudança incompatível, ela deixa de ser apenas refatoração e passa pelo
processo de feature ou ADR.

## Rastreabilidade

Cada entrada deve apontar para módulo, bug, débito ou decisão que a motivou. Alteração
de banco registra migration. Alteração visual registra larguras e evidências. Mudança
de autorização registra cenários permitidos e negados. Um resultado incompleto ou
parcial permanece aberto com próximos passos.

## Critérios de aceite

O comportamento protegido permanece equivalente, a complexidade reduz de forma
observável, não surgem dependências circulares, verificadores passam e o código
antigo deixa de ser usado. Métricas relevantes, como consultas, tamanho do bundle ou
duplicação, devem ser comparadas quando forem a razão principal da mudança.

## Revisão periódica

O registro é revisado junto do débito técnico. Refatorações repetidas na mesma área
podem indicar fronteira arquitetural incorreta e devem originar ADR.
