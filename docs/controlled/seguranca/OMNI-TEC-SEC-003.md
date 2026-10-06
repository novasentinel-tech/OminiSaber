# Gestão de Acessos Técnicos

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-SEC-003 |
| Versão / status | v1.0 / Ativo |
| Norma / classificação | LGPD / Uso Interno |
| Público / responsável | Técnico |
| Revisão | 2026-09-25 |

## Matriz

| Credencial | Destino | Onde pode existir | Proibição |
| --- | --- | --- | --- |
| Publishable/anon | navegador | configuração pública | não autoriza acesso privilegiado |
| Secret/service role | scripts e servidor | `.env` local seguro ou secret manager | nunca frontend, docs ou logs |
| JWT de usuário | cliente autenticado | memória/sessão gerenciada | não compartilhar entre contas |
| OpenAI API key | Edge Function do Copiloto | secret do ambiente | nunca navegador |
| Token de deploy | automação autorizada | cofre/secret do provedor | nunca repositório |

Conceder acesso nominal, com finalidade e prazo. Revogar na saída ou mudança de função. Revisar trimestralmente e após incidente. Contas compartilhadas e cópia de secrets por mensagem são proibidas.

## Princípios de concessão

Todo acesso nasce de solicitação identificada, justificativa, escopo mínimo, ambiente e aprovador. Privilégio administrativo é separado do uso cotidiano sempre que o provedor permitir. Acesso de produção não é concedido apenas porque alguém desenvolve localmente.

## Ciclo de vida de identidade

- **Entrada:** criar conta nominal, ativar proteção disponível, conceder papel mínimo e registrar aceite.
- **Mudança:** reavaliar privilégios quando função, equipe ou responsabilidade mudar; remover o acesso anterior antes de ampliar.
- **Saída:** revogar sessão, tokens, chaves e grupos no mesmo evento; transferir propriedade de automações.
- **Revisão:** comparar lista de pessoas, papéis e uso recente; remover contas inativas ou sem justificativa.

## Secrets e rotação

Secrets são criados no gerenciador do ambiente, possuem finalidade única e nunca são reutilizados entre ambientes. Rotacionar em exposição suspeita, saída de pessoa com conhecimento do valor, mudança de fornecedor e conforme política do serviço. Após rotação, validar dependentes e revogar a versão anterior.

## Acesso emergencial

O acesso de emergência deve ser limitado no tempo, aprovado ou justificado posteriormente, monitorado e revogado ao encerrar a ocorrência. A ação registra quem acessou, por quê, o que alterou e qual validação foi executada. Emergência não autoriza copiar dados pessoais para dispositivos locais.

## Auditoria e evidências

Manter solicitação, aprovação, data, papel, ambiente, revisão e revogação. Logs de autenticação e operações administrativas devem ter acesso restrito e retenção coerente com a finalidade. A revisão trimestral verifica também tokens de automação, integrações abandonadas e contas técnicas.

## Não conformidade

Credencial compartilhada, secret no repositório ou privilégio sem proprietário exige revogação/rotação e registro em SEC-002 ou SEC-004 conforme haja apenas exposição potencial ou evidência de uso indevido.
