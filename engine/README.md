# OminiStudio

O OminiStudio é a engine de criação e avaliação de experiências interativas do OminiSaber.

Nesta fase, o professor pode criar a mesma atividade por duas interfaces complementares:

- **Mesa de Montagem** — criação linear, rápida e guiada por blocos.
- **Mapa da Experiência** — visão espacial do fluxo, dos desvios e das decisões.

As duas interfaces usam o mesmo modelo de dados. Uma alteração feita em uma delas aparece na outra.

## Integração docente

O OminiStudio aparece no menu, nas ações rápidas e no destaque inicial dos quatro espaços docentes: Matemática, Português, Administração e Informática. O painel envia a especialidade e uma rota segura de retorno por parâmetros públicos. A engine confere a especialidade com o perfil autenticado, sincroniza o rascunho com o Supabase, publica versões imutáveis por turma e oferece “Voltar ao painel”.

O modo local permanece como recuperação e exportação. A publicação, as tentativas, as respostas, a correção automática, a revisão docente e a auditoria usam o modelo protegido definido em `backend/migrations/20260926120000_oministudio_persistencia_rls.sql`.

O percurso do aluno abre pela Central de Atividades em `/oministudio/?experience=<id>`. O identificador público permite localizar a experiência; a sessão e o vínculo com a turma continuam sendo validados no banco. Nenhum gabarito, token ou dado pessoal é enviado pela URL.

A integração completa exige a migration `backend/migrations/20261003_omnistudio_fluxo_integrado.sql`. Ela conecta o catálogo e as notificações, retoma tentativas, decide os caminhos no servidor e valida a entrega antes da correção. A presença do arquivo no repositório não confirma sua aplicação no Supabase remoto.

## Executar localmente

```bash
npm install
npm run dev
```

Para verificar o contrato no PostgreSQL embarcado local, sem rede ou banco remoto:

```bash
npm --prefix backend run test:studio:flow
```

Execute esse comando na raiz do OminiSaber; o projeto `backend` deve ter suas dependências instaladas.

## Documentação

O escopo, as decisões e a evolução planejada estão em [`Docs/`](./Docs/README.md).
