# Frontend

## Organização

Cada tela normalmente contém `index.html`, `style.css` e `script.js`. Recursos
compartilhados ficam em `frontend/shared/` e nos diretórios `shared/` de cada papel.
O portal docente especializado usa `frontend/professor/specialty/` para sidebar,
construtor, correção, resultados e Copiloto.

## Áreas

- `frontend/aluno/`: painel, atividades, trilhas, evolução, redação, biblioteca,
  agenda, notificações, perfil e ajuda.
- `frontend/professor/`: portal geral, agenda e quatro especialidades.
- `frontend/gestor/`: dashboard, contas, turmas, vínculos, descritores, conteúdos,
  acessos, auditoria e perfil.
- `frontend/bibliotecaria/`: operação do acervo e circulação.
- `frontend/login/`, `cadastro/` e `redefinir-senha/`: entrada e recuperação.

## Estado de tela

Uma página conectada deve representar quatro estados: carregando, conteúdo real,
vazio válido e erro acionável. Um erro do Supabase não pode ser escondido por dados
demonstrativos.

## Responsividade e navegação

Sidebars compartilhadas devem manter a mesma informação em todas as páginas. No
desktop podem ser recolhidas sem quebrar a largura do conteúdo; no celular funcionam
como painel sobreposto e precisam devolver o foco ao controle que as abriu.

Controles devem oferecer rótulo, foco visível, área de toque adequada e suporte a
teclado. Animações são curtas e respeitam `prefers-reduced-motion`.

## Execução

Não existe pipeline React/Vue ou etapa de build. Sirva a raiz por HTTP. O uso de
`file://` não é suportado para fluxos integrados.

## Acesso a dados

Páginas usam `window.OminiSaber`; não criam clientes paralelos e não recebem chaves
privadas. Relações PostgREST ambíguas devem indicar a constraint ou ser substituídas
por uma RPC com contrato claro.
