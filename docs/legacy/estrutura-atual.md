# Estrutura atual

```text
OminiSaber/
├── backend/
│   ├── config/
│   ├── scripts/
│   ├── ominisaber-supabase-client.js
│   ├── ominisaber-supabase-config.js
│   └── ominisaber-schema*.sql
├── docs/
│   ├── README.md
│   ├── arquitetura.md
│   ├── stack.md
│   ├── decisoes-arquiteturais.md
│   ├── seguranca.md
│   ├── padroes-do-projeto.md
│   └── experiencia-e-acessibilidade.md
├── frontend/
│   ├── aluno/
│   ├── bibliotecaria/
│   ├── professor/
│   │   ├── professor_matematica/{dashboard,laboratorio,avaliacoes}/
│   │   ├── professor_portugues/{dashboard,laboratorio,avaliacoes,redacoes}/
│   │   ├── professor_tecnico_administracao/{dashboard,laboratorio,avaliacoes}/
│   │   ├── professor_tecnico_informatica/{dashboard,laboratorio,avaliacoes}/
│   │   └── specialty/
│   ├── gestor/
│   ├── login/
│   ├── cadastro/
│   └── erro/
├── index.html
└── README.md
```

## Convenção de página

Cada rota usa index.html. Quando possui comportamento próprio, usa script.js; quando possui estilo próprio, usa style.css. code.html é somente redirecionamento de compatibilidade.

## Domínios do frontend

- aluno/dashboard_principal: próximo passo e mapa de domínio.
- aluno/modulo_de_trilhas: catálogo e páginas por matéria.
- aluno/laboratorio_de_redacao: produção e envio.
- aluno/minha_evolucao: XP, níveis e conquistas.
- aluno/biblioteca_digital: leitura e empréstimos.
- bibliotecaria/dashboard: prioridades diárias.
- bibliotecaria/gestao_emprestimos: aprovar, entregar e devolver.
- bibliotecaria/estoque: títulos, exemplares e seções.
- professor/professor_matematica: diagnóstico, investigação e avaliações matemáticas.
- professor/professor_portugues: oficinas, avaliações de Linguagens e redações.
- professor/professor_tecnico_administracao: projetos e avaliações profissionais.
- professor/professor_tecnico_informatica: laboratórios e avaliações técnicas.
