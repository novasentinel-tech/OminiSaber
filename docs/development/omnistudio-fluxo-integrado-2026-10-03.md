# OmniStudio — contrato integrado e verificação de 3 de outubro de 2026

## Problema identificado

A autoria publicava em `studio_*`, enquanto a Central do aluno consultava apenas `avaliacoes_docentes`. O catálogo tinha dezesseis tipos, mas a tabela de respostas aceitava seis. A RPC de início consumia outra tentativa a cada chamada; a entrega aceitava respostas ausentes; as decisões dependiam de intervalos removidos do snapshot público. O cliente também precisava acompanhar uma versão antiga depois de uma republicação e consultar a devolutiva após o prazo.

## Contrato incremental

Aplicar `backend/migrations/20261003_omnistudio_fluxo_integrado.sql` depois da migration de persistência do Studio. O schema completo inclui essa origem para instalações novas. Este trabalho verificou o SQL localmente e não aplicou alterações ao projeto remoto.

| RPC pública | Retorno principal |
| --- | --- |
| `listar_experiencias_aluno_studio()` | Array com identificação, título, disciplina, professor, versão, período, total de etapas, última tentativa e respostas salvas |
| `obter_experiencia_publicada_studio(experiencia_id)` | Trabalho seguro da publicação disponível ou da tentativa em andamento |
| `obter_experiencia_tentativa_studio(tentativa_id)` | Trabalho seguro da versão fixada e `tentativa.studio_respostas`; leitura da devolutiva permitida após o período |
| `iniciar_tentativa_studio(experiencia_id)` | `{ tentativa_id, versao, numero, retomada }`; início idempotente com trava transacional |
| `salvar_resposta_studio(tentativa_id, bloco_id, resposta, confirmada)` | `{ status: 'salva', bloco_id, confirmada }`; não informa acerto ou nota antes da entrega |
| `resolver_proximo_bloco_studio(tentativa_id, bloco_id)` | `{ nextBlockId }`; verifica conclusão e confirmação da etapa |
| `enviar_tentativa_studio(tentativa_id)` | Estado, pontuação automática, máximo de pontos do percurso e necessidade de revisão |
| `corrigir_resposta_studio(resposta_id, pontos, feedback)` | Correção de resposta aberta enviada, com recalculo e auditoria |

A assinatura pública de salvamento inclui `p_confirmada boolean default false`; chamadas antigas que enviam somente três argumentos continuam válidas. As tabelas de rascunho aceitam alterações pedagógicas, mas status e versão publicada são alterados somente pela RPC. Notas não aceitam atualização direta pelo navegador docente.

Ordenação e associação recebem itens embaralhados. Seus índices públicos são estáveis dentro da versão. O gabarito, as rubricas, os intervalos e os mapeamentos `_order`/`_rightOrder` permanecem no snapshot privado. As respostas incompletas são preservadas no autosalvamento, e o avanço/envio cobra sua completude. Mudar uma resposta que define o caminho remove evidências do ramo abandonado. A nota máxima usa somente o percurso realmente seguido. Uma tentativa antiga expirada não impede responder a uma publicação nova, e revisões pendentes bloqueiam repetição somente dentro da mesma versão.

## Evidência local

Na raiz do repositório:

```powershell
npm --prefix backend run test:studio:flow
node backend/scripts/check-database-governance.js
```

O teste usa `@electric-sql/pglite@0.5.8`, PostgreSQL embarcado com PL/pgSQL, e aplica as três migrations do domínio em memória, incluindo `20261003_omnistudio_matematica.sql`. Ele cria apenas o núcleo sintético necessário à integração, sem credenciais ou rede. Doze testes passaram, incluindo publicação e notificação, vínculo exato de disciplina, ciclos, catálogo, snapshot, retomada, respostas intermediárias, confirmação, entrega parcial, troca de ramo, revisão, limite de nota, isolamento por usuário, correção de ordenação/associação, explorações, limite de tentativas, republicação, prazo e metadados matemáticos públicos limitados sem exposição de critérios privados.

A governança local confirmou 86 tabelas públicas com RLS e nenhuma migration ausente do schema consolidado. Isso valida o contrato e suas negações no ambiente local. Ainda é necessário verificar a aplicação da migration, o deploy da Edge Function do Copiloto e o aceite visual autenticado no ambiente de destino antes de anunciar o fluxo como disponível remotamente.
