# Biblioteca Digital do aluno

Interface de descoberta e acompanhamento de livros, apostilas e materiais de apoio. A rota principal é `index.html`; `code.html` permanece como redirecionamento compatível com links legados.

## Funcionalidades

- Busca em tempo real por título, autor, matéria, categoria e palavras-chave.
- Filtros por matérias do Ensino Médio e categorias de material.
- Minha Estante com progresso percentual e ação de continuidade.
- Catálogo responsivo com status `Disponível`, `Em leitura` e `Concluído`.
- Modal nativo de detalhes com sinopse, páginas, categoria e link do material.
- Fallback visual para capas ausentes ou imagens que falham.
- Estado vazio ou erro explícito quando o catálogo real não puder ser consultado.

## Integração Supabase

O catálogo tenta usar `window.OminiSaber.listLivros()`, que consulta `livros` através do gateway existente. O estado de leitura usa o cliente já inicializado em `window.OminiSaber.client` para consultar e atualizar `leituras_aluno` apenas para o aluno autenticado.

A ação de leitura usa `upsert` com conflito em `aluno_id,livro_id`. O primeiro clique marca como `lendo`; o próximo conclui a leitura com `progresso_pct = 100`. A estante é formada exclusivamente pelos registros permitidos ao aluno no Supabase.

## Modelo recomendado

O arquivo `backend/schema/biblioteca.sql` cria ou complementa `livros` com `materia`, `categoria`, `capa_url`, `pdf_url`, `sinopse`, `paginas` e `palavras_chave`. Também cria `leituras_aluno` com status, progresso e timestamp de atualização.

As políticas RLS deixam o catálogo público para leitura e restringem inserção, atualização e leitura de leituras à própria identidade autenticada. O SQL foi criado fora desta pasta porque isso foi autorizado explicitamente para viabilizar a instalação no Supabase.
