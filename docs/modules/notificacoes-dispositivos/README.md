# Notificações nos dispositivos

## Objetivo

Quando professor ou gestor publica um compromisso na agenda, o OminiSaber já cria
o aviso interno da turma. A camada de push transforma esse aviso em uma
notificação do sistema operacional nos celulares e computadores autorizados pelos
alunos, inclusive quando o site está fechado.

## Fluxo

1. O professor publica o compromisso em `eventos_agenda`.
2. `sincronizar_notificacao_agenda()` cria uma linha em `notificacoes`.
3. `enfileirar_push_notificacao()` registra o aviso em `push_fila`.
4. A Edge Function `push-notifications` encontra os alunos ativos da turma e os
   respectivos registros em `push_dispositivos`.
5. Cada envio é reservado em `push_entregas`. A restrição única por notificação e
   dispositivo evita duplicidade em novas tentativas.
6. O service worker exibe o aviso. Ao tocar ou clicar, o aluno abre diretamente o
   compromisso na agenda.

O cliente docente solicita o disparo logo após a publicação. Para cobrir também
integrações administrativas e inserções fora do navegador, configure um Database
Webhook de `INSERT` em `public.push_fila` apontando para a mesma Edge Function.

## Permissão do aluno

Navegadores não permitem ativação silenciosa. Cada aluno deve abrir a Central de
notificações e escolher **Ativar neste dispositivo** uma vez em cada celular ou
computador. A recusa nunca bloqueia o aviso interno do OminiSaber.

- Android e desktop: Chrome, Edge e navegadores compatíveis funcionam por HTTPS.
- iPhone/iPad: o aluno deve adicionar o OminiSaber à Tela de Início e abrir por
  esse atalho antes de autorizar notificações.

## Segurança e RLS

- `push_dispositivos`: o usuário autenticado só enxerga e administra os próprios
  registros; as chaves nunca são públicas.
- `push_entregas`: o aluno só pode consultar as próprias entregas e não pode
  alterá-las.
- `push_fila`: sem acesso pelo navegador; somente a função com credencial de
  servidor processa a fila.
- A chave administrativa e a chave VAPID privada ficam apenas nos Secrets da
  Edge Function. Elas não entram no JavaScript do frontend nem no Git.

## Configuração de produção

Segredos necessários:

```text
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:suporte@ominisaber.app
PUSH_WEBHOOK_SECRET
```

O webhook deve enviar `Authorization: Bearer <service role>` ou o cabeçalho
`x-push-secret` com o valor de `PUSH_WEBHOOK_SECRET`. O corpo padrão de Database
Webhook já contém `record.notificacao_id`, que a função reconhece.

## Operação

`push_fila.status` mostra a situação geral do lote. `push_entregas` registra
sucesso, falha, código HTTP e inscrições expiradas. Respostas 404/410 desativam o
dispositivo automaticamente para evitar tentativas inúteis.
