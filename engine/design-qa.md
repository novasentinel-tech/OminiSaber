# Design QA — OminiStudio

Data: 2026-09-25  
Resultado: **PASS**

## Referências revisadas

- Mesa de Montagem: `C:\Users\CLEVERSON\.codex\generated_images\01a0bd78-5646-7ba0-87a4-e03c33a505a7\exec-65a73ec7-8918-4ec6-a529-ee91bc32de06.png`
- Mapa da Experiência: `C:\Users\CLEVERSON\.codex\generated_images\01a0bd78-5646-7ba0-87a4-e03c33a505a7\exec-8fd4e65c-0454-4056-a37d-842cdd4e1e68.png`
- Implementação renderizada e inspecionada no Codex In-app Browser: `http://127.0.0.1:4174/`

## Paridade visual

As referências e a implementação mantêm a mesma linguagem: azul institucional, superfícies claras, tipografia Manrope, hierarquia de editor profissional e distinção clara entre a Mesa linear e o Mapa espacial. A implementação foi adaptada para acrescentar navegação persistente, propriedades completas, validação e estados reais de interação.

## Breakpoints inspecionados

- desktop: 1850 × 835 CSS px;
- celular: 390 × 844 CSS px;
- comportamento intermediário coberto pelas regras de 760 px, 1000 px e 1200 px.

## Interações testadas

- inclinação Parallax com teclado e foco visível;
- navegação entre escolha, Mesa, Mapa e guia;
- biblioteca, montagem e configurações móveis;
- mapa com nós, ramificação Sim/Não, zoom e minimapa;
- prévia completa do aluno com resposta numérica, condição e respostas abertas;
- resultado separando nota objetiva de revisão docente;
- fechamento de modal com `Escape`;
- persistência local após edição;
- console sem erros de execução; durante as recargas do desenvolvimento, o React Flow emitiu apenas o aviso conhecido de troca da referência `nodeTypes` pelo HMR. O objeto permanece declarado fora do componente e não é recriado em renderizações normais ou no build de produção.

## Problemas encontrados e corrigidos

| Prioridade | Problema | Correção |
|---|---|---|
| P2 | O mapa aberto após uma aba móvel oculta podia iniciar desenquadrado. | O viewport inicial passou a ser definido explicitamente na inicialização do React Flow, com foco legível no celular e visão completa no desktop. |

## Resultado por severidade

- P0: 0
- P1: 0
- P2 pendentes: 0
- P3 pendentes: 0

O protótipo está aprovado para encerrar a fase de UX e seguir para testes com professores antes da integração de dados.
