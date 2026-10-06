# Onboarding do aluno

## Objetivo

Apresentar o OminiSaber sem obrigar o aluno a memorizar toda a navegação no primeiro acesso. A experiência combina uma recepção visual curta com orientações contextuais exibidas sobre as páginas reais.

## Fluxo

1. No primeiro acesso ao painel, o aluno vê a apresentação “Bem-vinda ao OminiSaber”.
2. A apresentação resume quatro territórios: Aprender, Acompanhar, Organizar e Criar.
3. “Começar passeio” inicia dez orientações contextuais: Início, Atividades, Trilhas, Redação, Evolução, Biblioteca, Notificações, Agenda, Perfil e Ajuda.
4. O passo atual é salvo por usuário. A troca de página mantém a posição do passeio.
5. O aluno pode voltar, avançar, pular ou fechar com `Esc`.
6. O tutorial pode ser reaberto em Ajuda e suporte.

## Persistência

O estado local usa a chave versionada `ominisaber:student-onboarding:v1:<usuario-id>`. Isso impede que preferências de alunos diferentes sejam misturadas no mesmo dispositivo e permite reiniciar o onboarding quando houver uma mudança estrutural futura.

- `active`: passeio em andamento, com o índice do passo atual;
- `completed`: passeio concluído;
- `skipped`: passeio pulado;
- `dismissed`: apresentação desativada pela opção “Não mostrar novamente”.

Fechar a apresentação sem marcar “Não mostrar novamente” vale apenas para a sessão atual.

## Responsividade

- Desktop: coachmark ancorado ao item destacado, com o restante da tela suavemente escurecido.
- Tablet: diálogo reorganizado em uma coluna e ilustração reduzida.
- Celular: apresentação ocupa a tela e o coachmark vira uma folha inferior, preservando a navegação móvel.
- Telas baixas: a ilustração é removida para priorizar conteúdo e ações, e a grade passa obrigatoriamente para uma única coluna de largura total. Essa regra é independente da regra de celular para impedir que o conteúdo ocupe a antiga coluna estreita da ilustração.

## Acessibilidade

- diálogo inicial nativo com foco inicial na ação principal;
- títulos e descrições associados por ARIA;
- foco visível em todos os controles;
- alvos de toque com pelo menos 44 px;
- fechamento por `Esc`;
- contraste alto e texto independente de cor;
- respeito a `prefers-reduced-motion`;
- imagem com texto alternativo;
- botão permanente para rever o tutorial.

## Arquivos

- `frontend/Parties/student-onboarding.js`
- `frontend/Parties/student-onboarding.css`
- `frontend/Parties/assets/student-onboarding.png`
- `frontend/Parties/parties.js`
- `backend/scripts/check-student-onboarding.js`

