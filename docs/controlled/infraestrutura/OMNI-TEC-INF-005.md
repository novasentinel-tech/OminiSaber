# Planejamento de Capacidade

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-INF-005 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público | Técnico / Gestão |
| Responsável / revisão | Técnico / 2026-09-25 |

## Diretriz

O sistema ainda não possui série histórica suficiente para uma previsão numérica confiável. A capacidade deve crescer a partir de medições reais por turma, atividades publicadas, tentativas, arquivos e chamadas de funções.

## Gatilhos de revisão

- consultas pedagógicas com degradação perceptível ou scans sequenciais recorrentes;
- conexões próximas do limite do plano;
- crescimento de Storage sem referência ativa;
- picos de entrega ou correção com erros/timeout;
- Copiloto atingindo limites diários;
- frontend excedendo orçamento de carregamento móvel.

## Plano

1. estabelecer baseline em homologação;
2. medir períodos de aula e prazos de entrega;
3. revisar índices e planos de execução;
4. testar carga antes de ampliar escolas/turmas;
5. promover capacidade ou particionamento somente com evidência.

## Escopo de capacidade

O planejamento considera banco, conexões, autenticação, armazenamento, funções, banda, bundle do frontend e serviços de IA. Também considera capacidade humana para observar, responder e recuperar o sistema. O volume pedagógico é projetado por escolas, turmas, usuários ativos, atividades, tentativas, respostas, anexos e notificações.

## Cenários de demanda

- **Rotina:** acesso distribuído durante aulas e planejamento docente.
- **Pico acadêmico:** entregas, avaliações e correções concentradas em uma janela.
- **Expansão:** inclusão de novas turmas ou escolas com crescimento sustentado.
- **Degradação:** provedor lento, limite reduzido ou dependência parcialmente indisponível.

Cada cenário registra premissas, volume, duração, operações dominantes e tolerância a falhas. Estimativas sem medição são marcadas como hipótese.

## Teste e critérios

Testes de capacidade usam dados sintéticos e respeitam limites do ambiente. Devem observar latência percentil, erros, conexões, consumo de função, crescimento de tabelas e tempo de carregamento móvel. O critério não é apenas suportar o pico: o sistema deve manter autorização correta, consistência e recuperação após a carga.

## Estratégias de resposta

Priorizar paginação, índices, consultas seletivas, processamento assíncrono, cache seguro e retenção antes de aumentar custo. Separar componentes somente quando a medição demonstrar gargalo ou risco de isolamento. Qualquer mudança estrutural gera ADR e teste de regressão.

## Responsabilidades e revisão

O técnico mantém baseline e proposta; gestão aprova orçamento e risco residual; responsáveis pedagógicos informam calendário e expansão. Revisar trimestralmente, antes de período crítico e depois de incidente de capacidade. RTO, RPO e limites finais permanecem pendentes de aprovação formal e contrato do ambiente de produção; não devem ser inventados a partir do protótipo.
