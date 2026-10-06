# Registro de Features Implementadas

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-DEV-003 |
| Versão | v1.0 |
| Status | Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

| Área | Entrega atual | Evidência |
| --- | --- | --- |
| Autenticação | login, sessão e roteamento por papel | [Autenticação](../../architecture/autenticacao.md) |
| Aluno | painel, atividades, trilhas, evolução, redação, agenda e biblioteca | [Módulo do aluno](../../modules/aluno/README.md) |
| Professor | painéis por especialidade, avaliações, agenda, redações e laboratórios | [Módulo docente](../../modules/professor/README.md) |
| Gestor | contas, turmas, vínculos, currículo, acessos e auditoria | [Administração](../../modules/administracao/README.md) |
| Biblioteca | acervo, exemplares, solicitações e circulação | [Biblioteca](../../modules/biblioteca/README.md) |
| Atividades | autoria, publicação, tentativas, correção, resultados e recuperação | [Motor](../../modules/motor-atividades/README.md) |
| Currículo | catálogo comum e importação controlada | [Catálogo](../../modules/catalogo-curricular-base-comum.md) |
| Banco | schema consolidado, migrations, RLS e governança automática | [Schema](../../database/schema.md) |
| Engine | seleção de fluxo e protótipos de criação interativa | [Documentação da engine](../../../engine/Docs/README.md) |

O estado de liberação e as restrições constam em [Status do projeto](../../development/status-do-projeto.md).

## Critério de implementação

Uma feature entra neste registro quando possui fluxo utilizável, contrato de dados,
autorização, tratamento de erro, documentação e verificação proporcional ao risco.
Protótipos visuais e código local não promovido aparecem com estado explícito. Uma
tela que depende de mock não é considerada integrada.

## Detalhamento por jornada

**Aluno.** A navegação reúne início, atividades, trilhas, agenda e demais recursos.
Atividades suportam retomada, múltiplas tentativas quando configuradas, entrega e
resultado. Evolução usa evidências corrigidas e separa estados sem evidência.

**Professor.** Há experiências para Matemática, Português, Administração e
Informática apoiadas por vínculos e motor comuns. O professor cria avaliações,
laboratórios, redações e compromissos, acompanha entregas e registra devolutivas.

**Gestão.** O portal mantém perfis, turmas, vínculos, currículo, solicitações de
acesso e trilha administrativa. Operações de conta usam Edge Function para não
expor credencial elevada.

**Biblioteca.** O domínio diferencia catálogo, exemplar físico, solicitação,
empréstimo, entrega e devolução. Quantidades derivadas precisam reconciliar com os
exemplares.

**Engine.** A aplicação oferece uma tela de escolha de fluxo e conceitos de autoria
guiada. Ela permanece em protótipo até integrar identidade, persistência, avaliação
e publicação sob o mesmo modelo de segurança.

## Atualização do registro

Toda nova entrada informa data, versão, ambiente, estado e evidência. Regressões não
apagam a feature: mudam seu estado e geram bug. Remoções registram motivo, migração
de dados e impacto sobre usuários e documentação.
