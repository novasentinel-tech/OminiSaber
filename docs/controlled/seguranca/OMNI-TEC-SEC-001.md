# Política de Segurança da Informação

| Campo | Valor |
| --- | --- |
| Código | OMNI-TEC-SEC-001 |
| Versão / status | v1.0 / Ativo |
| Norma / classificação | LGPD / Uso Interno |
| Público | Técnico / Gestão |
| Responsável / revisão | Técnico / 2026-09-25 |

## Princípios

Menor privilégio, necessidade de conhecimento, defesa em profundidade, rastreabilidade, minimização de dados e divulgação responsável. Sessão, papel, vínculo escolar e RLS precisam concordar para autorizar uma operação.

## Controles obrigatórios

- secrets somente em ambiente servidor;
- RLS em toda tabela pública e grants explícitos;
- autenticação e autorização verificadas em Edge Functions;
- gabaritos, notas e auditorias protegidos;
- migrations revisáveis e backups antes de mudanças de risco;
- logs sem senhas, tokens ou conteúdo pessoal desnecessário;
- resposta privada a vulnerabilidades e incidentes.

A política operacional completa, escopo e safe harbor estão em [Política de Segurança](../../security/security-policy-pt-br.md). Este documento é o registro controlado que a incorpora.

## Escopo e classificação

A política alcança código, banco, arquivos, integrações, estações autorizadas, ambientes e pessoas com acesso técnico. Dados de cadastro, vínculos escolares, atividades, respostas, notas, devolutivas e auditoria são tratados conforme necessidade e sensibilidade. Dados de autenticação e chaves têm acesso estritamente técnico; conteúdo pedagógico pessoal não deve aparecer em logs de diagnóstico.

## Responsabilidades

O responsável técnico implementa controles, mantém evidências e coordena resposta. A gestão aprova riscos residuais, acessos de alto privilégio e prioridades de continuidade. Desenvolvedores protegem secrets, revisam dependências e tratam falhas. Usuários administrativos operam apenas dentro do papel autorizado. Todo acesso é pessoal e rastreável.

## Controles por camada

- **Identidade:** sessão válida, revogação, política de senha e proteção contra abuso.
- **Aplicação:** validação de entrada, mensagens neutras, autorização no servidor e prevenção de exposição no bundle.
- **Banco:** RLS, grants mínimos, constraints, funções com `search_path` controlado e auditoria.
- **Infraestrutura:** separação de ambientes, secrets gerenciados, backups e mudanças registradas.
- **Dados:** minimização, finalidade definida, retenção e descarte seguro.

## Desenvolvimento seguro

Mudanças sensíveis exigem revisão por pares, cenário negativo por papel e verificação de segredo. Dependências são fixadas quando possível e avaliadas antes de atualização. Exceções temporárias precisam de justificativa, responsável, prazo, compensação e aprovação; expiração sem renovação bloqueia promoção.

## Privacidade e conformidade

O tratamento observa finalidade, necessidade, transparência e segurança previstas na LGPD. Solicitações de titulares e incidentes são encaminhados à responsabilidade definida pela organização. Este documento não declara certificação ISO, auditoria independente ou conformidade jurídica integral; ele descreve controles internos que precisam ser comprovados e revisados.

## Revisão e conscientização

A política é revista semestralmente, após incidente relevante ou mudança arquitetural. Pessoas com acesso técnico recebem orientação sobre phishing, compartilhamento de credenciais, dados de teste e comunicação de incidentes. A eficácia é verificada por auditorias, testes de autorização, rotação e análise de vulnerabilidades.
