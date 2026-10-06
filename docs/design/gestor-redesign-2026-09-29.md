# Redesign do portal do gestor — 29/09/2026

## Objetivo

Transformar o módulo do gestor em um ambiente administrativo direto, confiável e profissional, com leitura rápida das prioridades da escola e sem elementos decorativos que pareçam gerados por IA.

## Direção escolhida

Foi implementada a opção 1: **Painel operacional institucional**.

- Navegação lateral organizada por domínio: Visão geral, Pessoas, Currículo, Administração e Conta.
- Cabeçalho compacto com pesquisa global, ano letivo, notificações, perfil e ação principal.
- Resumo institucional em uma faixa única de indicadores.
- Prioridades apresentadas em tabela operacional, com estado, quantidade, área e ação.
- Atalhos administrativos persistentes para as tarefas mais frequentes.
- Cobertura curricular exibida por componente, com detalhes carregados apenas quando solicitados.

## Sistema visual

- Fundo geral cinza muito claro e superfícies brancas.
- Azul institucional reservado para seleção, ações principais e estados ativos.
- Verde, âmbar e vermelho usados apenas para comunicar situação.
- Bordas discretas, sombras reduzidas e cantos moderados.
- Hierarquia tipográfica forte, com textos auxiliares menores e de alto contraste.
- Ícones funcionais; nenhuma ilustração decorativa no fluxo administrativo.

## Responsividade

### Desktop

- Sidebar fixa e conteúdo dividido entre operação principal e atalhos.
- Tabelas preservam leitura horizontal e densidade administrativa.

### Tablet

- Conteúdo passa para uma coluna quando necessário.
- Sidebar vira gaveta e os controles do cabeçalho são compactados.

### Mobile

- Navegação lateral abre como gaveta sobreposta.
- Indicadores são empilhados.
- Linhas de tabela viram cartões com rótulos de coluna visíveis.
- Ações mantêm alvos de toque adequados e formulários usam largura total.
- Modais respeitam a altura útil da tela e permitem rolagem interna.

## Desempenho

- A tabela detalhada de descritores não é carregada na primeira pintura do painel.
- Os dados curriculares completos são requisitados apenas ao expandir “Ver detalhes dos descritores”.
- A estrutura reutiliza o módulo de dados existente e não adiciona novas dependências visuais.

## Acessibilidade e usabilidade

- Contraste reforçado em textos, botões e estados.
- Navegação por teclado preservada em links, botões, campos e elementos expansíveis.
- Estados não dependem apenas de cor: todos possuem rótulo textual.
- Pesquisa global encaminha o termo para a pesquisa local da tela quando disponível.
- Tabelas responsivas recebem automaticamente os rótulos de suas colunas.

## Telas contempladas

1. Visão geral
2. Turmas
3. Alunos
4. Professores
5. Vínculos
6. Descritores
7. Conteúdos publicados
8. Acessos e senhas
9. Auditoria
10. Perfil

## Validação realizada

- Autenticação com conta de gestor e carregamento de dados reais.
- Verificação visual em desktop e celular.
- Teste da gaveta de navegação no mobile.
- Teste do modal de criação de conta no mobile.
- Verificação de ausência de transbordamento horizontal nas dez rotas.
- Verificação de sintaxe dos módulos JavaScript compartilhados.

## Observação sobre a verificação automatizada do banco

O script legado `manager:check` consulta recursos protegidos sem estabelecer a sessão do gestor e, por isso, informa falsos negativos nas tabelas cobertas por RLS. O acesso autenticado pelo portal foi validado e os dados foram carregados normalmente. O script deverá receber autenticação própria antes de ser usado como critério de aprovação da persistência.
