# Auditoria de desempenho e responsividade — área do professor

Data: 29/09/2026  
Escopo: painel, laboratórios, avaliações, redações, agenda e OminiStudio; professores de Português, Matemática, Administração e Informática.

## Resultado executivo

A área docente permanece funcional e responsiva, com redução expressiva do carregamento inicial do OminiStudio e menos trabalho repetido durante buscas. Os módulos mais pesados continuam sendo carregados apenas quando a tela realmente precisa deles.

## Etapas auditadas

1. **Painel da especialidade — saudável.** Cabeçalho, navegação, métricas e cartões não apresentam rolagem horizontal; cartões fora da área visível usam renderização adiada pelo navegador.
2. **Laboratório/oficina — saudável.** Formulário, seletor curricular e lista lateral adaptam-se para uma coluna em telas menores; a pesquisa curricular passou a aguardar uma breve pausa antes de consultar novamente.
3. **Avaliações — saudável.** Construtor, correção e recuperação continuam sob demanda. Os arquivos pesados não entram na listagem inicial.
4. **Redações — saudável.** Folha de estilos e lógica específicas são carregadas somente ao entrar no módulo; pesquisa de entregas foi suavizada e a página não transborda em desktop, tablet ou Android.
5. **Agenda — saudável.** Busca não redesenha a lista a cada tecla; cartões usam renderização adiada e o formulário mantém uma coluna segura no celular.
6. **OminiStudio inicial — saudável.** Imagens educacionais foram otimizadas de 3.248,4 KiB para 320,3 KiB, redução aproximada de 90% sem alterar as dimensões visuais.
7. **Mapa da Experiência — saudável.** React Flow e o CSS do mapa foram separados do pacote inicial e entram somente quando o professor abre o mapa.
8. **Tablet e Android — saudável.** Sem rolagem horizontal em 768 × 1024 e 390 × 844; sidebar vira gaveta, navegação móvel permanece acessível e o cabeçalho móvel foi limitado a 74 px.
9. **Inicialização da conexão — saudável.** A biblioteca do Supabase foi fixada na versão 2.57.0 em todas as páginas docentes, eliminando a dependência de uma versão flutuante e tornando o cache previsível.

## Ganhos medidos

| Recurso | Antes | Depois | Resultado |
|---|---:|---:|---:|
| JavaScript inicial do OminiStudio | 517,1 KiB | 334,5 KiB | −35,3% |
| CSS inicial do OminiStudio | 55,7 KiB | 40,3 KiB | −27,6% |
| Artes carregadas na entrada | 3.248,4 KiB | 320,3 KiB | −90,1% |
| Código do mapa | no pacote inicial | 183,3 KiB sob demanda | não bloqueia a entrada |
| CSS do mapa | no pacote inicial | 15,5 KiB sob demanda | não bloqueia a entrada |

Os arquivos de referência mantidos em `engine/public/assets` não são solicitados pela página e, portanto, não afetam o tempo de abertura no navegador.

## Alterações técnicas

- carregamento sob demanda do módulo de redações;
- separação do mapa do OminiStudio em um pacote próprio;
- compressão das artes educacionais para JPEG otimizado;
- `content-visibility: auto` em cartões e painéis repetitivos;
- debounce nas buscas de agenda, redações e currículo;
- versão fixa do cliente Supabase nas páginas docentes;
- cabeçalho compacto no celular e menos alto no tablet;
- arquivos-fonte e CSS gerado do sistema visual mantidos sincronizados.

## Verificações

- sintaxe validada para portal, agenda e redações;
- fluxo docente de avaliações validado;
- fluxo do aluno em avaliações validado;
- resultados e recuperação validados;
- build de produção do OminiStudio concluído;
- pacote para Sites validado com 5 testes aprovados;
- inspeção visual em desktop, tablet e Android sem transbordamento horizontal;
- mapa confirmado com carregamento tardio do JavaScript e CSS do React Flow.

## Risco residual

O arquivo global `frontend/Parties/parties.css` ainda reúne o sistema visual de vários perfis. Ele é cacheável e necessário para manter a padronização atual, mas uma futura divisão por perfil poderá reduzir ainda mais o primeiro carregamento sem alterar o design.

