# Monitoramento Pós-Deploy

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-OPS-003 |
| Versão / status | v1.0 / Ativo |
| Classificação | Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

## Janela de observação

Verificar imediatamente, após 30 minutos e no próximo período real de uso. Mudanças de autenticação, banco ou atividade exigem observação ampliada.

## Checklist

- disponibilidade e assets sem 404;
- login, sessão e roteamento por papel;
- erros de console, Data API e Edge Functions;
- latência e falhas das consultas principais;
- criação, publicação, entrega e correção quando afetadas;
- RLS negando acessos indevidos;
- layout em celular e desktop;
- volume anormal de erros, notificações ou tentativas.

Registrar resultado, evidência, responsável e decisão: manter, corrigir ou reverter. Incidentes seguem INF-004 ou SEC-004 conforme a natureza.

## Objetivo e escopo

O monitoramento confirma que a versão opera corretamente sob uso real e detecta regressões que o smoke test não revelou. Aplica-se ao frontend, autenticação, banco, funções, storage, integrações e principais jornadas do escopo implantado.

## Fontes de observação

Usar logs do provedor, erros de navegador, métricas agregadas, resultados de consultas, relatos funcionais e execução de casos sintéticos. Não coletar conteúdo de respostas ou dados pessoais quando contagens e identificadores técnicos forem suficientes. A ausência de alerta automatizado exige verificação manual registrada.

## Limiares e decisão

Falha de autorização, perda de dados, login indisponível ou erro sistemático é bloqueante e aciona contenção/rollback. Crescimento anormal de erro, latência ou consumo abre investigação com prazo. Diferença visual limitada pode permanecer com correção planejada se não bloquear acessibilidade ou uso.

## Roteiro por janela

- **Imediata:** disponibilidade, assets, login, console, migrations e função alterada.
- **30 minutos:** erros, latência, repetição, filas e registros incoerentes.
- **Próximo uso real:** fluxo completo por papel, volume e comportamento móvel.
- **Encerramento:** comparar baseline, consolidar relatos e aprovar manutenção da versão.

## Escalonamento

O observador registra o sinal e aciona o executor. O responsável técnico decide correção ou reversão; gestão participa quando há impacto escolar ou indisponibilidade prolongada. Indício de exposição segue imediatamente SEC-004, sem esperar o fim da janela.

## Evidência e aprendizado

O registro inclui versão, ambiente, período, métricas, jornadas, anomalias, ações e decisão. Após cada falha não detectada antes, adicionar caso ou alerta apropriado. A janela só termina quando os sinais estão estáveis ou o risco residual foi explicitamente aceito.
