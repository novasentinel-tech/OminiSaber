# Parties

`Parties` é a fonte única do sistema visual compartilhado do OminiSaber. Toda página HTML do frontend importa `parties.css` e `parties.js`; estilos específicos continuam responsáveis apenas pelo conteúdo exclusivo de cada tela.

## Estrutura

- `tokens.css`: cores, tipografia, espaçamento, raios, sombras e transições.
- `foundations.css`: base tipográfica, foco, seleção, acessibilidade e redução de movimento.
- `components.css`: botões, campos, cartões, etiquetas, tabelas, estados, modais e navegação.
- `header.css`: header contextual único, aplicado aos cabeçalhos existentes de todas as áreas.
- `layouts.css`: cascas de aplicação, autenticação, páginas utilitárias e responsividade.
- `themes.css`: identidade por perfil sem criar sistemas visuais separados.
- `layouts/student-dashboard.css`: composição exclusiva do painel principal do aluno.
- `mobile.css`: shell touch-first, drawer, barra inferior e adaptações responsivas compartilhadas.
- `responsive.css`: espaçamento de ações e composição responsiva de aulas e cabeçalhos.
- `shell-init.js` e `shell-critical.css`: estado inicial da navegação, inserido no head das páginas do aluno antes da primeira renderização.
- `styles.entry.css`: ordem dos módulos usados para gerar `parties.css`, que é o bundle servido ao navegador.
- `parties.js`: identifica perfil/layout, melhora semântica e mantém a camada visual por último.
- `index.html`: catálogo vivo de componentes.
- `migrate-html.mjs`: conecta a base compartilhada às páginas existentes.
- `check.mjs`: valida cobertura, caminhos e arquivos obrigatórios.

## Uso

Em páginas novas, importe somente estes dois arquivos com o caminho relativo correto:

```html
<link rel="stylesheet" href="../../Parties/parties.css?v=20260922-3" />
<script src="../../Parties/parties.js?v=20260922-3" defer></script>
```

Use os tokens `--os-*` e as classes compartilhadas antes de criar CSS local. O CSS local deve tratar apenas necessidades próprias da tela.

Depois de editar módulos CSS ou criar páginas, execute `node frontend/Parties/migrate-html.mjs`. O comando regenera o bundle e atualiza os imports e o shell inicial. Não edite o `parties.css` gerado diretamente. Ao publicar alterações, atualize `partiesVersion` no gerador para invalidar os arquivos em cache.

## Validação

```powershell
node frontend\Parties\check.mjs
```
