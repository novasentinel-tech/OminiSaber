# Arquitetura

## Modelo compartilhado

Mesa e Mapa operam sobre o mesmo objeto de trabalho:

```text
Work
├── id, title, objective, status
├── start
├── edges[] { source, target, sourceHandle? }
└── blocks[]
    ├── id, type, title, instructions
    ├── position { x, y }
    ├── points, parâmetros próprios do tipo
    └── advanceRule? { required, prompt }
```

Isso evita conversões entre editores e permite alternar de visualização sem perder conteúdo.

## Camadas desta fase

- `src/core/work.js`: tipos, exemplos, avaliação, conexões e validação.
- `src/components/useCardMotion.js`: interação 3D dos cartões da tela inicial.
- `src/App.jsx`: casca do produto, editores, simulação e revisão.
- `src/styles.css`: sistema visual e responsividade.
- `vite.config.mjs`: build com `base: "./"`, necessário para abrir a aplicação tanto no hosting próprio quanto em `/engine/dist/client/` dentro do repositório OminiSaber.

## Persistência atual

O rascunho é salvo imediatamente em `localStorage` e sincronizado, com debounce, na tabela `studio_experiencias`. A cópia local permite recuperação diante de uma interrupção de rede; o Supabase é a fonte canônica quando a sessão docente está autenticada. A chave local continua versionada e segmentada por especialidade.

O acesso ao banco usa o usuário confirmado por `auth.getUser()`. O parâmetro `teacherType` contextualiza a interface, mas nunca concede autorização: a especialidade é comparada com `perfis.tipo_professor`, e as turmas vêm de `professor_turma_materias`.

## Entrada pelos painéis docentes

`frontend/professor/specialty/portal.js` é o ponto compartilhado pelos quatro tipos de professor. Ele cria a entrada do OminiStudio no menu e no dashboard e envia somente:

- `teacherType`, validado contra as quatro especialidades conhecidas;
- `returnTo`, aceito pela engine apenas quando começa com `/frontend/professor/`.

A engine converte a especialidade em nome do componente curricular e oferece retorno ao painel de origem. Nome, turma, token, credencial e dados pessoais não transitam pela URL.

## Camada de dados

`src/core/studio-api.js` oferece operações equivalentes a:

```text
loadLatestStudioDraft(teacherType)
saveStudioDraft(work)
publishStudioExperience(work, classIds)
loadPublishedStudioExperience(experienceId)
startStudioAttempt(experienceId)
saveStudioAnswer(attemptId, blockId, answer)
submitStudioAttempt(attemptId)
gradeStudioAnswer(responseId, points, feedback)
```

O modelo preserva o formato de `Work`. A publicação gera um snapshot imutável em `studio_experiencia_versoes`; a associação a turmas, tentativas, respostas e auditoria ocupa tabelas próprias. O aluno não recebe a linha privada da versão: uma RPC devolve um snapshot sanitizado sem `correct`, `min`, `max` ou `rubric`.

As operações que precisam consultar gabaritos usam funções `SECURITY DEFINER` no schema privado, com validação explícita de `auth.uid()`, papel, turma e propriedade. Wrappers públicos permanecem `SECURITY INVOKER`, têm `EXECUTE` revogado de `PUBLIC` e `anon` e são concedidos apenas a `authenticated`.

## RLS e privilégios

- Professor: cria, lê e atualiza apenas os próprios rascunhos; publica somente para vínculos ativos de sua disciplina.
- Aluno: não lê rascunhos nem snapshots privados; acessa apenas publicações ativas de sua turma por RPC sanitizada.
- Gestor: pode supervisionar registros conforme políticas explícitas.
- Anônimo: não recebe privilégios sobre tabelas ou RPCs do Studio.
- Versões publicadas: bloqueadas contra `UPDATE` e `DELETE`.
- Testes: `backend/supabase/tests/oministudio_rls.test.sql` cobre permissões e negações essenciais.

## Percurso integrado — 3 de outubro de 2026

A migration `20261003_omnistudio_fluxo_integrado.sql` completa o contrato de execução dos dezesseis tipos. A Central do aluno recebe o catálogo pela RPC `listar_experiencias_aluno_studio()`. As notificações por turma levam à mesma experiência. `iniciar_tentativa_studio` retoma uma tentativa em andamento; cliques repetidos não consomem o limite.

`obter_experiencia_tentativa_studio` sempre devolve a versão vinculada à tentativa, inclusive para consultar devolutivas depois do encerramento. Uma nova publicação não substitui uma atividade em andamento dentro do período autorizado. O catálogo prioriza essa tentativa e passa a mostrar a publicação mais recente quando a anterior é concluída ou seu período termina. A revisão docente bloqueia novas tentativas na mesma versão; uma nova versão publicada pode ser iniciada separadamente.

O autosalvamento aceita digitação intermediária, respostas limpas e interações parcialmente preenchidas. `salvar_resposta_studio` possui uma única assinatura pública com `p_confirmada boolean default false`. As confirmações obrigatórias e a completude são verificadas ao avançar e ao enviar. Até a entrega, não há nota nem indicação de acerto na resposta da RPC.

`resolver_proximo_bloco_studio` decide a próxima etapa a partir das respostas persistidas. Os intervalos de condições permanecem privados. A entrega valida todas as etapas do percurso efetivamente seguido, respeita a disponibilidade da turma e calcula o máximo de pontos desse percurso. Alterar uma resposta que controla uma bifurcação descarta as respostas do ramo abandonado.

Ordenação usa `{ order: [índices públicos] }`. Associação usa `{ matches: { índiceEsquerdo: índiceDireitoPúblico } }`. Os itens são embaralhados uma vez na publicação; o snapshot privado mantém `_order` e `_rightOrder`, que não são devolvidos ao aluno. Associação publica `leftItems`, `rightItems` e `items` com os termos esquerdos, sem expor os pares corretos. Balanceamento e resposta aberta seguem para revisão docente.

A correção só começa depois do envio e passa pela RPC auditada. O navegador docente não possui mais permissão de atualizar notas diretamente. O campo `studio_tentativas.pontos_maximos` registra o denominador real do percurso para a devolutiva.

O teste `backend/tests/studio-integrated-flow.test.mjs` aplica ambas as migrations do Studio em PostgreSQL embarcado e exercita os papéis, RPCs, versões, interações e negações. Ele usa um núcleo sintético local; não verifica a configuração ou o deploy remoto.

## Avaliação

- número e múltipla escolha podem ser avaliados automaticamente;
- resposta aberta exige rubrica e revisão do professor;
- condição controla percurso e não deve somar nota por padrão;
- conteúdo e Flourish registram visualização, não acerto;
- o resultado precisa guardar evidências por bloco e por tentativa.
