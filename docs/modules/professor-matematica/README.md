# Professor de Matemática

## Objetivo

Transformar a criação de atividades matemáticas em um fluxo visual, alinhado ao
currículo e reutilizável pelo motor unificado do OminiSaber.

## Autoria

O professor percorre as quatro etapas comuns do construtor: contexto, currículo,
experiência e revisão. Na etapa de experiência, o **Ateliê matemático** acrescenta
seis modelos:

| Modelo              | Interação do aluno                              | Referência curricular inicial |
| ------------------- | ----------------------------------------------- | ----------------------------- |
| Questão livre       | cálculo, alternativa ou demonstração            | qualquer descritor            |
| Plano cartesiano    | marcação de um ponto por clique, toque ou setas | `D043_M`                      |
| Reta numérica       | deslocamento de marcador graduado               | `D009_M`, `D033_M`            |
| Triângulo e medidas | leitura do desenho e resposta numérica          | `D049_M`                      |
| Laboratório de medidas | figura 2D ou sólido 3D manipulável          | geometria plana e espacial    |
| Leitura de gráfico  | seleção direta de uma barra                     | `D064_M`                      |

Cada modelo possui campos próprios e prévia ao vivo. A troca de modelo altera o
editor, o tipo de correção e a experiência apresentada ao aluno.

O **Laboratório de medidas** cobre quadrado, retângulo, triângulo, círculo,
trapézio, losango, polígono regular, cubo, paralelepípedo, cilindro, cone,
esfera, prisma e pirâmide. Há também uma figura 2D e um sólido 3D personalizados,
nos quais o professor nomeia a forma e até quatro medidas. Em todos os casos, ele
define unidade, objetivo do cálculo, gabarito, tolerância e resolução de
referência.

O roteiro de questões aparece depois do editor e não acompanha mais a rolagem. O
professor pode minimizá-lo sem perder as questões, a ordem ou a soma dos pontos.

## Persistência e correção

Não existe uma tabela paralela para Matemática. O cabeçalho continua em
`avaliacoes_docentes`, a questão em `questoes_avaliacao` e os parâmetros visuais
em `questoes_avaliacao.configuracao`. O campo `mathMode` identifica o modelo. As
respostas usam as mesmas RPCs de tentativa, salvamento e entrega do motor geral.

Plano cartesiano, reta numérica, triângulo, laboratório de medidas e gráfico
possuem gabarito
determinístico e seguem para correção automática no banco. O gabarito não é
incluído na consulta usada pelo navegador do aluno.

Para respostas numéricas e cálculos, a margem definida em **Tolerância aceita**
é aplicada pelo banco. O valor correto permanece no gabarito protegido e a
margem faz parte da configuração usada pela correção; uma resposta fora do
intervalo recebe zero. O banco
também rejeita limites invertidos, ponto fora dos eixos, medidas não positivas,
forma incompatível com a dimensão, quantidade inválida de lados e gráfico sem
uma categoria correta válida.

No laboratório geométrico, `target` e `solution` são removidos da configuração
pública antes de a questão ser armazenada. O valor correto continua disponível
somente em `gabaritos_avaliacao`; atualizações internas reidratam o valor apenas
durante a validação e voltam a descartá-lo antes da gravação.

## Responsividade e acessibilidade

- cartões de modelo passam de cinco para três e depois para uma coluna;
- o plano aceita toque e oferece botões de ajuste para uso por teclado;
- reta e gráfico possuem rótulos acessíveis;
- figuras e sólidos permitem girar, ampliar e ocultar/revelar medidas sem mudar
  os valores definidos pelo professor;
- controles mantêm área de toque adequada em telas pequenas;
- a atividade continua com salvamento automático por questão.

## Arquivos principais

- `frontend/professor/professor_matematica/avaliacoes/`;
- `frontend/professor/specialty/activity-builder.js`;
- `frontend/professor/specialty/configs.js`;
- `frontend/aluno/atividades/`;
- `backend/ominisaber-supabase-client.js`.
