# Plano de Testes

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-TST-001 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

## Escopo

Cobrir autenticação, autorização, jornadas por papel, banco, atividades, currículo, agenda, redação, biblioteca, responsividade, acessibilidade e deploy.

## Camadas

- **Estática:** sintaxe, referências, documentação e segredos.
- **Banco:** parse SQL, schema consolidado, RLS, grants, constraints e migrations.
- **Contrato:** scripts de cada domínio no `backend`.
- **Integração:** usuários reais de teste por papel e cenários permitidos/negados.
- **Interface:** desktop, tablet e celular; estados vazio, carregando, sucesso e erro.
- **Regressão:** bugs corrigidos e screenshots datadas quando o layout for relevante.

## Critérios de entrada e saída

Entrada exige ambiente e dados identificados. Saída exige zero erro crítico/alto aberto no escopo, verificadores aprovados, regressão principal executada e limitações registradas. Aprovação local não substitui integração com RLS real.

## Objetivos de qualidade

Os testes demonstram que a função atende ao comportamento previsto, preserva dados e nega operações indevidas. O plano prioriza jornadas reais: professor planeja e publica; aluno recebe, executa e consulta resultado; professor corrige; gestão acompanha; biblioteca controla acervo. Aparência aprovada sem persistência ou autorização correta não encerra o teste.

## Ambientes e dados

Testes locais usam dados sintéticos. Homologação deve reproduzir schema, RLS, functions e configuração pública da versão candidata. Contas de teste são identificadas por papel, turma e estado; não reutilizar credenciais ou respostas de usuários reais. Após execução que cria volume, remover dados conforme roteiro controlado.

## Papéis e responsabilidades

O autor da mudança define impacto e testes unitários/estáticos. O revisor verifica cenários negativos e regressão. O responsável funcional confirma regras pedagógicas. O responsável pelo deploy consolida evidências e decisão. Quando uma pessoa acumula papéis, a revisão deve deixar claro o risco e o que foi verificado.

## Estratégia por risco

Mudanças em login, RLS, notas, gabaritos, migrations e exclusão têm prioridade máxima. Layouts exigem resoluções móveis e desktop, zoom, teclado e estados extremos. Integrações exigem indisponibilidade, timeout, repetição e retorno inválido. Correções de bug sempre adicionam um caso que reproduza a falha original.

## Gestão de defeitos

Falhas registram ambiente, versão, passos, esperado, obtido, evidência e severidade. Um bloqueio crítico interrompe a promoção. Desvio aceito exige responsável, prazo, alternativa e aprovação. Após correção, executar reteste específico e regressão adjacente.

## Evidências e manutenção

Comandos, resultados, capturas e dados de preparação ficam vinculados ao caso ou lote. Evidência visual inclui rota, viewport e data. Este plano é revisto a cada módulo novo, incidente significativo ou mudança de arquitetura; a matriz de casos em TST-002 deve permanecer sincronizada.
