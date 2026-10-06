# Padrão de seletores — aluno e professor

**Versão:** 1.0  
**Status:** implementado  
**Público:** produto, design e desenvolvimento  
**Responsável:** equipe OminiSaber  
**Revisão:** 27 de setembro de 2026

## Objetivo

Padronizar campos de seleção nas experiências de aluno e professor. O componente substitui a apresentação visual nativa, que varia entre navegadores, sem alterar o valor ou os eventos do elemento `select` original.

## Anatomia

O seletor possui:

1. valor selecionado como informação principal;
2. texto auxiliar com o contexto do campo;
3. ícone de expansão com estado aberto e fechado;
4. lista flutuante com ícone, título, descrição e marca de seleção;
5. fundo de foco no mobile para destacar a decisão atual.

## Comportamentos

- Clique ou toque abre a lista de opções.
- Uma nova opção atualiza o `select` original e dispara os eventos `input` e `change`.
- `Escape` fecha a lista e devolve o foco ao acionador.
- Setas, `Home` e `End` percorrem as opções quando o menu está aberto.
- Seletores adicionados dinamicamente também são reconhecidos.
- Campos `multiple`, `size` maior que 1 ou com `data-native-select` permanecem nativos.
- Campos desabilitados mantêm a aparência e o estado indisponível.

## Responsividade

### Desktop e tablet

A lista é posicionada junto ao campo, respeitando as bordas da janela e das superfícies flutuantes. A largura mínima é de 230 px e a altura máxima é limitada ao espaço visível. Quando não há espaço suficiente abaixo, ela abre para cima. Listas longas possuem rolagem própria por mouse ou trackpad, sem movimentar a página ao fundo.

### Mobile e Android

Em telas de até 680 px, a lista assume o formato de painel inferior. O painel respeita as áreas seguras do aparelho, possui alvos de toque maiores, rolagem isolada e utiliza fundo de foco para evitar interação acidental com o conteúdo atrás.

### Ajuda contextual em janelas flutuantes

Os cartões de informação são renderizados acima da estrutura do formulário para não serem cortados por labels, colunas ou áreas com `overflow`. Em desktop e tablet, o cartão é reposicionado automaticamente dentro dos limites do modal e mantém a seta apontando para o ícone acionado. Em celulares, assume o formato de cartão inferior com largura segura.

## Acessibilidade

- O acionador usa `aria-haspopup="listbox"`, `aria-expanded` e nome acessível.
- O menu usa `role="listbox"` e cada item usa `role="option"`.
- A opção atual informa `aria-selected="true"`.
- O `select` original permanece no documento para preservar integração com formulários e scripts.
- Foco visível, contraste e redução de movimento seguem as preferências do sistema.

## Implementação

### Aplicação principal

- Estilos: `frontend/shared/omni-select.css`
- Comportamento: `frontend/shared/omni-select.js`
- Inicialização: `frontend/Parties/parties.js`
- Distribuição visual: importação por `frontend/Parties/parties.css`

O carregamento é limitado aos papéis `student` e `teacher` identificados pelo shell compartilhado.

### OmniStudio

O editor React utiliza a implementação `OmniSelect` em `engine/src/App.jsx`, com a mesma linguagem visual. Ela atende o assistente de percurso e os destinos configurados no inspetor de blocos.

## Uso e exceções

Use o elemento HTML `select` normalmente. O shell faz o aprimoramento automaticamente. Para manter a interface nativa em um caso excepcional:

```html
<select data-native-select aria-label="Exemplo nativo">
  <option>Opção</option>
</select>
```

Descrições e ícones opcionais podem ser informados diretamente nas opções:

```html
<option value="turma-a" data-description="1º ano · 32 alunos" data-icon="groups">
  Turma A
</option>
```

## Checklist de manutenção

- Preservar `aria-label` ou associação com `label`.
- Não remover o evento `change` do campo original.
- Conferir menu aberto e fechado em desktop e mobile.
- Verificar conteúdo dinâmico depois de filtros ou renderização assíncrona.
- Usar `data-native-select` apenas quando houver justificativa funcional.
