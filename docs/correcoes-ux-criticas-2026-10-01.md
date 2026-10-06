# Correções críticas de UX — 01/10/2026

Este documento registra as correções executadas após a auditoria em `Auditoria de fluxo/UX-COMPLETA-2026-10-01`.

## OminiStudio

- O mapa passou a usar `fitView` com limites específicos para desktop e dispositivos móveis.
- Foi adicionado o comando visível **Enquadrar percurso**, além do controle nativo do mapa.
- A abertura e mudanças de tamanho recalculam o enquadramento a partir das etapas existentes; não há mais uma posição inicial fixa.
- O zoom mínimo foi reduzido para comportar percursos maiores em telas estreitas.
- O estado de nuvem agora diferencia: conectado, somente local, sessão encerrada, acesso não autorizado e indisponibilidade temporária.
- Quando a sessão termina, o professor recebe uma explicação persistente, pode entrar novamente ou exportar o rascunho local.
- Em telas pequenas, “Testar percurso” e “Revisar e publicar” ficam agrupados no menu **Ações**, reduzindo a densidade do cabeçalho.
- Toasts móveis passaram para o topo para não cobrir os campos de configuração.

## Autenticação

- A redefinição de senha inicia em estado de validação.
- Os campos de nova senha só aparecem após um evento `PASSWORD_RECOVERY` ou uma sessão associada a um marcador válido de recuperação.
- Links inválidos ou expirados são informados antes de o usuário preencher a senha.
- A tela foi alinhada ao azul institucional do login.
- “Esqueci minha senha” passou de link sem destino para botão semântico.

## Desempenho e disponibilidade

- O cliente `@supabase/supabase-js` 2.112.3 foi fixado e servido em `backend/vendor`, eliminando o carregamento pelo jsDelivr nas páginas do frontend.
- O cadastro não usa mais Tailwind em runtime por CDN; seus estilos essenciais agora são locais.
- Seis imagens de login e trilhas foram convertidas para JPEG otimizado. O conjunto caiu de aproximadamente 11,3 MiB para menos de 1 MiB.
- As capas das vitrines usam carregamento preguiçoso, decodificação assíncrona e dimensões explícitas.
- A imagem principal do login usa dimensões explícitas e prioridade alta, evitando deslocamento de layout.

## Acessibilidade

- A oficina de tese ganhou rótulo visível e associação `for`/`id` para o editor.
- A busca da gestão de empréstimos ganhou rótulo programático.
- O comando de enquadramento do mapa possui nome acessível.

## Empacotamento

- O pacote do Netlify inclui `backend/vendor/supabase-2.112.3.js`.
- O teste da rota docente foi atualizado para o endereço público `/oministudio/`.
- Novos testes cobrem enquadramento do mapa, estados de nuvem, recuperação, rótulos, ausência das CDNs removidas e limite de tamanho das imagens otimizadas.

## Limite de validação

As mudanças de autenticação foram implementadas conforme o fluxo atual do Supabase Auth e não alteram políticas, tabelas ou RLS. A validação completa de sincronização e publicação ainda exige uma sessão real de professor.
