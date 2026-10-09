# Hub de Trilhas

O `index.html` é o portal de entrada do módulo. Ele apresenta o catálogo completo do Ensino Médio, agrupado em Linguagens, Matemática, Ciências da Natureza e Ciências Humanas, e direciona cada card para uma página de disciplina independente.

Cada disciplina possui um ecossistema próprio, sem sidebar global: identidade visual, ferramenta de estudo, progresso específico e carregamento de trilhas do Supabase. O filtro do hub é apenas um recurso de descoberta; não substitui páginas de matéria.

As páginas consultam `window.OminiSaber.listTrilhas()` e `window.OminiSaber.listStudentProgress()`. O progresso é filtrado pelo campo `atividades.trilhas.materia`, enquanto blocos interativos podem ser escolhidos pelo professor com `trilhas.interacao_tipo` e `trilhas.interacao_config` no Supabase. Nenhuma página acessa tabelas diretamente.
