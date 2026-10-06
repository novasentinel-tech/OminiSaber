# OmniStudio — autoria, aluno e Copiloto

Verificação local de 3 de outubro de 2026. A implementação e o pacote público foram preparados. Banco remoto, Edge Function e hospedagem não foram alterados.

## Percurso e saúde de cada etapa

1. **Começar uma atividade — verificado no navegador.** O professor informa título e objetivo, escolhe uma receita pedagógica ou começa em branco. O rascunho anterior permanece em Minhas atividades. [Criação guiada](02-nova-atividade.jpg).
2. **Montar e configurar — verificado no navegador e por testes.** A mesa conecta sequências automaticamente; mover uma etapa atualiza o percurso. O mapa preserva ramificações explícitas. Campos têm rótulos acessíveis, orientação contextual e validação com acesso direto ao bloco que precisa de ajuste. [Mesa conectada](03-mesa-conectada.jpg).
3. **Testar como aluno — verificado do início ao resultado.** Associação, ordenação com setas, explicação, revisão e conclusão funcionaram na mesma interface usada pelas atividades publicadas. A prévia avaliou as duas respostas objetivas e marcou a resposta aberta para revisão docente. [Ordenação final](10-aluno-ordenacao-final.jpg), [resultado](11-resultado-final.jpg).
4. **Publicar para a turma — contrato verificado em PostgreSQL local.** A revisão mostra estrutura, turmas e período. Validação impede publicação incompleta, ciclos e decisões com fonte indisponível. Versões são imutáveis e gabaritos ficam fora do snapshot do aluno. O navegador local sem sessão bloqueou corretamente a publicação. [Revisão](12-revisao-publicacao.jpg).
5. **Responder, retomar, entregar e corrigir — contrato verificado em PostgreSQL local.** O catálogo do aluno inclui o Studio junto das avaliações tradicionais. Autosalvamento aceita respostas intermediárias; avanço e entrega cobram respostas completas. A retomada mantém a versão correta, e uma tentativa antiga expirada não bloqueia publicação nova. A correção docente respeita a pontuação e libera devolutiva ao aluno. Os testes cobrem usuários de outra turma, outro professor e anônimo.
6. **Planejar com o Copiloto — interface e contratos verificados.** A intenção pedagógica, turma, habilidades e panorama agregado geram uma proposta editável, com refinamento, adição e revisão antes de substituição. Questões, gabaritos e rubricas são validados no servidor. O uso do panorama começa desativado. A revisão de condições e mídias informa que propõe uma sequência linear. [Computador](09-copiloto-desktop.jpg), [celular](08-copiloto-mobile.jpg). A chamada real ao provedor depende da implantação da função atualizada.

## Evidência automatizada

- 60 testes passaram em `node --test engine/tests/*.test.mjs tests/*.test.mjs backend/tests/*.test.mjs backend/scripts/test-copilot-contract.mjs`.
- A integração utiliza PostgreSQL embarcado em memória, com dados sintéticos, sem alterar o projeto remoto.
- Compilação de produção passou; `netlify-dist` foi regenerado com a versão final.
- Contrato Supabase do Studio: 18/18 verificações; Copiloto e documentação passaram.
- Governança: 86 tabelas públicas com RLS, nenhuma falha ou migration ausente do schema consolidado.
- Parser SQL validou as origens e o schema consolidado usando a biblioteca Python já disponível no ambiente.

## Conferência visual e limites

Foram usados computador (1440 × 1000) e celular (390 × 844). A interação teve foco nas etapas, controles identificáveis por leitores de tela, confirmação de resposta e revisão antes da entrega. O Copiloto teve sua sobreposição de diálogos corrigida. A largura de celular foi conferida sem overflow horizontal do documento; a viewport temporária foi restaurada ao final.

O aceite visual autenticado do catálogo, da fila de correção e da geração real de IA ainda precisa ocorrer no ambiente de destino após a implantação. Esta sessão não dispõe de conexão DDL ou credencial de deploy do Supabase. As credenciais públicas/administrativas da Data API não substituem essa conexão.

## Artefatos para implantação

1. Aplicar a [migration incremental](../../../backend/migrations/20261003_omnistudio_fluxo_integrado.sql) após a persistência inicial do Studio.
2. Publicar a função `professor-copiloto` atualizada no mesmo projeto Supabase.
3. Publicar o pacote `netlify-dist` e validar o ciclo autenticado professor → aluno → devolutiva.

O [contrato integrado](../../development/omnistudio-fluxo-integrado-2026-10-03.md) detalha RPCs, isolamento de respostas e versões. O pacote público exclui arquivos de ambiente, migrations, scripts administrativos e dependências.
