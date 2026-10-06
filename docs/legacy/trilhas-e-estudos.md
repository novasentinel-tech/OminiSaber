# Trilhas e estudos

O módulo de estudos do aluno é um fluxo único, responsivo e orientado a dados. Títulos, textos, vídeos, materiais, questões, dicas, progresso, recompensas, favoritos, anotações, respostas e histórico vêm do Supabase. Quando não existe conteúdo publicado, a interface mostra um estado vazio; ela não inventa aulas ou atividades.

## Páginas

| Página               | Rota                                                            | Fonte principal                                                      |
| -------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| Catálogo             | `frontend/aluno/modulo_de_trilhas/index.html`                   | `trilhas`, `atividades`, `progresso_atividades`                      |
| Detalhe              | `frontend/aluno/modulo_de_trilhas/trilha/index.html?id=UUID`    | `trilhas`, `trilhas_prerequisitos`, `atividades`                     |
| Aula                 | `frontend/aluno/modulo_de_trilhas/aula/index.html?id=UUID`      | `atividades`, `materiais_aula`, `anotacoes_aula`                     |
| Atividade            | `frontend/aluno/modulo_de_trilhas/atividade/index.html?id=UUID` | `questoes_atividades`, `tentativas_atividades`, `respostas_questoes` |
| Resultado            | `frontend/aluno/modulo_de_trilhas/resultado/index.html?id=UUID` | tentativas e respostas avaliadas pelo banco                          |
| Salvos               | `frontend/aluno/modulo_de_trilhas/salvos/index.html`            | `conteudos_salvos`                                                   |
| Histórico            | `frontend/aluno/modulo_de_trilhas/historico/index.html`         | `historico_estudos`, `xp_movimentos`                                 |
| Mapa de dificuldades | `frontend/aluno/mapa_dificuldades/index.html?materia=CODIGO`    | `trilhas`, `atividades`, `progresso_atividades`                      |

O mapa é aberto pelo clique duplo, toque duplo ou tecla Enter nas bolhas de matéria do painel. O nó central “Geral” usa uma proporção ponderada (`etapas concluídas / etapas publicadas`) e cada descritor mantém acesso direto à trilha correspondente. Sem etapas publicadas, a interface informa “sem evidência” em vez de assumir zero como desempenho medido.

Todas as rotas usam o mesmo shell visual, menu lateral no computador e navegação móvel. Os filtros do catálogo são derivados dos registros retornados, e o progresso é calculado pela relação entre etapas publicadas e etapas concluídas.

## Modelo editorial

Uma trilha define público, contexto e recompensa: área de conhecimento, série, trimestre, dificuldade, duração, XP, capa, tags e turma. As etapas ficam em `atividades`, ordenadas pelo campo `ordem`, e podem ser do tipo `aula` ou `atividade`.

O campo `atividades.conteudo` aceita um objeto JSON com a propriedade `blocos`. Cada bloco possui `tipo` e conteúdo próprio:

```json
{
  "blocos": [
    { "tipo": "titulo", "texto": "Título da seção" },
    { "tipo": "paragrafo", "texto": "Conteúdo da aula." },
    { "tipo": "lista", "itens": ["Primeiro ponto", "Segundo ponto"] },
    { "tipo": "citacao", "texto": "Trecho para análise." },
    {
      "tipo": "destaque",
      "titulo": "Observe",
      "texto": "Uma orientação importante."
    },
    { "tipo": "imagem", "url": "https://...", "alt": "Descrição acessível" },
    {
      "tipo": "codigo",
      "linguagem": "javascript",
      "texto": "const exemplo = true;"
    }
  ]
}
```

Vídeo usa `video_url`; anexos e links complementares são registros de `materiais_aula`. URLs são validadas no navegador e só são abertas quando usam HTTP ou HTTPS.

## Atividades e correção

`questoes_atividades` contém o enunciado, alternativas, dica, explicação pública e pontuação, mas não contém o gabarito. O gabarito fica em `private.gabaritos_questoes`, sem acesso direto de `anon` ou `authenticated`.

Uma alternativa pode ser uma string ou um objeto com `valor` e `rotulo`. A resposta persistida usa o formato `{ "valor": "..." }`. Um gatilho `security definer` compara a resposta com o gabarito, grava `correta` e `pontos_obtidos`, e outro gatilho recalcula a tentativa, conclui o progresso, cria o movimento de XP e registra o histórico. Assim, o navegador nunca recebe a resposta correta antes da tentativa.

## Progresso, XP e pré-requisitos

- `trilhas_prerequisitos` liga uma trilha a outra e pode exigir conclusão.
- `atividades.prerequisito_atividade_id` bloqueia uma etapa até a anterior ser concluída.
- `progresso_atividades` guarda conclusão e nota por aluno.
- `xp_movimentos` é um livro-razão: cada origem só gera XP uma vez por aluno.
- `historico_estudos` registra abertura, conclusão de aula e conclusão de atividade.

## Segurança

As tabelas expostas têm RLS habilitado e permissões explícitas. O aluno só lê trilhas publicadas globais ou de sua própria turma; só lê e altera tentativas, respostas, favoritos, anotações, progresso e histórico cujo `aluno_id` seja o seu `auth.uid()`. Professores só publicam conteúdo para turmas vinculadas em `professor_turmas`; gestores mantêm acesso administrativo.

As políticas usam `(select auth.uid())`, filtros por turma e índices nas colunas usadas por RLS e junções. A chave `service_role` não deve existir no frontend. O arquivo `backend/ominisaber-supabase-config.js` deve conter apenas a chave pública compatível com o projeto.

## Instalação no Supabase

1. Confirme que `backend/ominisaber-supabase-config.js` aponta para o projeto correto.
2. Execute primeiro o schema-base do OminiSaber, caso ainda não esteja instalado.
3. Aplique `../../backend/migrations/20260831_trilhas_estudos_completos.sql` no mesmo projeto.
4. Cadastre trilhas e atividades com `publicada = false`, revise o conteúdo e só então publique.
5. Cadastre cada questão pública em `questoes_atividades` e seu gabarito correspondente em `private.gabaritos_questoes`.
6. Valide com contas reais de aluno de turmas diferentes, professor e gestor antes de produção.

Não há `INSERT` de conteúdo de demonstração na migração. O catálogo só mostra material editorial realmente cadastrado e autorizado pelo Supabase.
