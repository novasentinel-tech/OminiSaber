# Padrões de Codificação

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-DEV-001 |
| Versão | v1.0 |
| Status | Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Criação / revisão | 2026-09-25 |

## Regras gerais

- código, nomes de arquivo e rotas devem ser previsíveis e específicos;
- JavaScript usa módulos quando a página permitir, funções pequenas e estados explícitos de carregamento, vazio e erro;
- HTML declara `lang="pt-BR"`, viewport, título e botões com `type` em formulários;
- CSS parte de tokens e componentes existentes, respeita foco visível, contraste, áreas de toque e breakpoints móveis;
- SQL usa `snake_case`, objetos qualificados por schema, migrations transacionais, RLS e grants mínimos;
- nenhuma chave privada, senha ou resposta protegida entra no cliente, log ou documentação;
- dados reais têm precedência sobre placeholders; indisponibilidade aparece como erro tratável.

## Validação mínima

Execute verificadores do domínio, `system:audit`, `database:governance:check`, `docs:check` e testes visuais proporcionais à alteração. Consulte [convenções detalhadas](../../development/convencoes-de-codigo.md) e [checklist](../../development/checklist-de-desenvolvimento.md).

## Escopo e organização

As regras valem para frontend, scripts Node, Edge Functions TypeScript, SQL,
documentação e testes. Código novo deve seguir o padrão do domínio existente antes
de introduzir abstrações. Funções e arquivos recebem nomes ligados ao comportamento,
não ao autor ou à data provisória.

## JavaScript e TypeScript

Use `const` por padrão, `let` somente para reatribuição e `async/await` para fluxos
assíncronos legíveis. Trate `{ data, error }` do Supabase e converta falhas em estados
visíveis. Não capture erros para retornar listas vazias enganosas. Normalize dados na
borda e mantenha cálculo pedagógico crítico no banco. Listeners precisam de ciclo de
vida claro para não duplicar eventos em navegação ou reabertura de modal.

## HTML e acessibilidade

Estruture cabeçalhos em ordem, associe `label` a campos e use botões reais para
ações. Conteúdo dinâmico anuncia mudança quando necessário. Diálogos possuem nome,
foco inicial, fechamento por botão e Escape, e devolvem foco ao acionador. Imagens
informativas têm alternativa textual; ícones decorativos são ignorados pelo leitor.

## CSS responsivo

Comece pela menor largura suportada. Evite dimensões fixas para texto, `overflow`
global e elementos sob a navegação inferior. Reutilize tokens de cor, espaço, raio e
tipografia. Breakpoints mudam composição quando o conteúdo exige, não para um modelo
específico de aparelho.

## SQL

Qualifique schemas, evite SQL dinâmico quando uma consulta tipada resolver e indexe
FKs e colunas de policies. Uma função privilegiada usa `search_path = ''`, valida o
chamador e recebe grants explícitos. Migrations são atômicas, idempotentes quando
necessário e nunca incluem credenciais ou limpeza destrutiva genérica.

## Revisão

O revisor confirma clareza, compatibilidade, segurança, estados de erro, testes e
documentação. Código formatado não é automaticamente correto; a revisão segue o
fluxo do usuário e os limites de autorização.
