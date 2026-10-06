# Evolução — páginas compartilhadas

- index.html: visão geral, XP, registros da semana e próximo passo.
- desempenho.html: retrato atual por descritor, com filtros por matéria e situação.
- conquistas.html: galeria e detalhes de níveis e conquistas.
- historico.html: estudo e movimentos de XP, período e paginação visual.
- medalhas.html: mantém o endereço antigo com a nova galeria.

Componentes e comportamento: frontend/Parties/evolution.js.
Estilos: frontend/Parties/layouts/student-evolution.css.
Após editar estilos, executar node frontend/Parties/migrate-html.mjs.

Não são criados registros nem alteradas regras de XP. As consultas usam a sessão existente.
O histórico de estudo exibe até 200 registros (limite atual da API), explicitamente indicado na tela.
Desempenho é cumulativo: não exibe tendências temporais sem dados que as sustentem.
Conquistas bloqueadas mostram o requisito cadastrado, sem inventar progresso parcial.
