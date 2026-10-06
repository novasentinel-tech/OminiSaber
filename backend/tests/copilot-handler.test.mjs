import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import * as contract from '../supabase/functions/professor-copiloto/pedagogical-contract.ts';
import * as studio from '../supabase/functions/professor-copiloto/studio-contract.ts';

const professor = '10000000-0000-4000-8000-000000000001';
const classId = '20000000-0000-4000-8000-000000000001';
const sessionId = '30000000-0000-4000-8000-000000000001';
const executionId = '40000000-0000-4000-8000-000000000001';
const source = fs.readFileSync(new URL('../supabase/functions/professor-copiloto/index.ts', import.meta.url), 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
const ideas = { resumo: 'Três investigações acessíveis para comparar quantidades.', avisos: [], ideias: [1, 2, 3].map(index => ({ titulo: `Investigar a situação ${index}`, objetivo: `Comparar as quantidades da situação ${index} e justificar uma conclusão.`, gancho: 'Duas medições parecem descrever resultados diferentes.', acao_aluno: `Compare o conjunto ${index}, formule uma hipótese e justifique uma conclusão.`, evidencia: 'Uma conclusão apoiada em duas comparações explicadas.', interacao_tipo: 'lista', duracao_minutos: 15, dificuldade: 'introducao', materiais: ['Tabela de dados no enunciado'], adaptacoes: ['Oferecer um exemplo independente para apoiar a leitura de dados.'], pedido_professor: `Crie uma atividade completa para comparar a situação ${index}, com dados, gabaritos e feedback explicativo.`, habilidade_ids: [] })) };
const activity = index => ({ titulo: `Comparar evidência ${index}`, orientacoes: 'Compare as duas quantidades e responda usando a unidade indicada.', categoria: 'atividade', duracao_minutos: 10, valor_total: 1, modo_pontuacao: 'manual', questoes: [{ tipo: 'calculo', enunciado: `Divida a quantidade ${index * 4} em duas partes iguais. Quanto terá cada parte?`, alternativas: [], resposta: String(index * 2), explicacao: 'Divida a quantidade por dois e verifique multiplicando o resultado por dois.', pontos: 1, habilidade_ids: [], obrigatoria: true }] });
const trail = { resumo: 'Um percurso completo de modelagem seguido de aplicação em outro contexto.', avisos: [], trilha: { titulo: 'Comparar e transferir', descricao: 'Use uma comparação inicial como apoio para resolver outra situação.', etapas: [
  { titulo: 'Modelar a comparação', objetivo: 'Interpretar uma divisão em duas partes iguais.', interacao_tipo: 'calculadora', fase: 'modelagem', ponte: 'Use a interpretação da divisão para decidir no próximo problema.', atividade: activity(1) },
  { titulo: 'Aplicar a um novo cenário', objetivo: 'Transferir a divisão para outra quantidade e verificar o resultado.', interacao_tipo: 'lista', fase: 'transferencia', ponte: 'Explique como o mesmo método funciona com a nova quantidade.', atividade: activity(2) },
] } };

function server({ output = ideas, providerStatus = 200, providerError, providerResponses = [], internalError, profileRole = 'professor', professorId = professor, authenticated = true, analysisData, budgetCount = 0, session = { id: sessionId, contexto: {} }, sessionReadError, memoryWriteError, configuration = {} } = {}) {
  const queries = []; const providerCalls = []; const providerSignals = []; const diagnostics = [];
  const db = { from(table) {
    const query = { table, filters: [], mutation: null }; queries.push(query);
    const result = () => {
      if (internalError && table === 'perfis') return { data: null, error: new Error(internalError) };
      if (table === 'copiloto_sessoes') {
        if (query.mutation?.kind === 'insert') { session = { id: sessionId, contexto: query.mutation.value.contexto }; return { data: { id: sessionId }, error: null }; }
        if (query.mutation?.kind === 'update') {
          if (!memoryWriteError) session = { id: sessionId, contexto: query.mutation.value.contexto };
          return { data: null, error: memoryWriteError ? new Error(memoryWriteError) : null };
        }
        return { data: session, error: sessionReadError ? new Error(sessionReadError) : null };
      }
      if (table === 'professor_turma_materias') {
        const owner = query.filters.find(([key]) => key === 'professor_id')?.[1];
        return { data: owner === professor && professorId === professor ? { turma_id: classId, materia_codigo: 'matematica' } : null, error: null };
      }
      const tables = { perfis: { id: professorId, role: profileRole, ativo: true, tipo_professor: 'matematica' }, feature_flags: { habilitada_global: true, configuracao: configuration }, feature_flag_usuarios: null, professor_turma_materias: { turma_id: classId, materia_codigo: 'matematica' }, turmas: { id: classId, nome: 'Turma de teste', serie: '2ª série', ano_letivo: 2026 }, copiloto_execucoes: { id: executionId } };
      return { data: Object.hasOwn(tables, table) ? tables[table] : [], error: null, count: budgetCount };
    };
    const builder = {
      select(columns) { query.columns = columns; return builder; },
      eq(key, value) { query.filters.push([key, value]); return builder; }, in() { return builder; }, gte() { return builder; }, order() { return builder; }, limit() { return builder; },
      insert(value) { query.mutation = { kind: 'insert', value }; return builder; }, update(value) { query.mutation = { kind: 'update', value }; return builder; },
      single() { return Promise.resolve(result()); }, maybeSingle() { return Promise.resolve(result()); }, then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    }; return builder;
  },
  async rpc(name, args) {
    queries.push({ rpc: name, args });
    if (name === 'reservar_execucao_copiloto') {
      return { data: budgetCount >= args.p_limite_por_minuto ? [{ execution_id: null, limit_reason: 'minute' }] : [{ execution_id: executionId, limit_reason: null }], error: null };
    }
    if (name === 'resumo_habilidades_copiloto') {
      return { data: analysisData || { activityCount: 4, correctedAttemptCount: 12, criticalSkills: [{ id: '50000000-0000-4000-8000-000000000001', code: 'HAB-01', description: 'Comparar evidências.', performancePercent: 42, evidenceCount: 12, descriptors: [{ code: 'D-01', description: 'Identificar relações.' }] }] }, error: null };
    }
    if (name === 'buscar_habilidades_curriculares') {
      const skillId = '50000000-0000-4000-8000-000000000001';
      return { data: args.p_serie === 2 && args.p_trimestre === 2 ? [{ habilidade_id: skillId, codigo: 'HAB-01', descricao: 'Comparar evidências.', serie: 2, trimestre: 2, descritores: [{ codigo: 'D-01', titulo: 'Identificar relações.' }] }] : [], error: null };
    }
    return { data: null, error: new Error(`Unexpected RPC: ${name}`) };
  } };
  let handler;
  const secrets = { SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_ANON_KEY: 'synthetic-public-key', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key', GEMINI_API_KEY: 'synthetic-model-key' };
  const sandbox = { ...contract, ...studio, crypto: globalThis.crypto, performance, Request, Response, AbortSignal, Error, SyntaxError,
    console: { warn: value => diagnostics.push(JSON.parse(value)) },
    Deno: { env: { get: key => secrets[key] }, serve: callback => { handler = callback; } },
    createClient: (_url, _key, options) => options.global ? { ...db, auth: { getUser: async () => ({ data: { user: authenticated ? { id: professorId } : null }, error: authenticated ? null : new Error('missing session') }) } } : db,
    supabaseCorsHeaders: {}, PORTUGUESE_PROMPT_CASES: [], GENERAL_PROMPT_CASES: [], selectPortuguesePromptCases: () => [], selectGeneralPromptCases: () => [],
    fetch: async (_url, options) => {
      providerCalls.push(JSON.parse(options.body));
      providerSignals.push(options.signal);
      if (providerError) throw providerError;
      const supplied = providerResponses[Math.min(providerCalls.length - 1, providerResponses.length - 1)];
      if (supplied) return new Response(JSON.stringify(supplied.body), { status: supplied.status || 200, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ output_text: JSON.stringify(output), usage: { input_tokens: 12, output_tokens: 18 }, error: providerStatus !== 200 ? 'synthetic-provider-secret-error' : undefined }), { status: providerStatus, headers: { 'Content-Type': 'application/json' } });
    },
  };
  vm.runInNewContext(stripTypeScriptTypes(source), sandbox);
  return { queries, providerCalls, providerSignals, diagnostics, send: async overrides => {
    const request = new Request('http://localhost:4173/functions/professor-copiloto', { method: 'POST', headers: { Authorization: 'Bearer synthetic-session-token', Origin: 'http://localhost:4173', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'gerar_ideias', subject: 'matematica', classId, objective: 'Criar uma investigação com dados e conclusão verificável.', questionCount: 2, duration: 20, value: 2, skillIds: [], useClassContext: false, ...overrides }) });
    const response = await handler(request); return { status: response.status, body: await response.json() };
  } };
}

test('handler gera ideias e trilhas com logging válido, escopo docente e contexto limitado', async () => {
  for (const [action, output] of [['gerar_ideias', ideas], ['gerar_trilha', trail]]) {
    const edge = server({ output });
    const result = await edge.send({ action, currentActivity: { title: 'Rascunho', instructions: 'Investigue dois dados.', aluno_id: 'private-student-id', questions: [] }, messages: [{ role: 'user', content: 'Torne o desafio mais concreto para a turma.' }] });
    assert.equal(result.status, 200, JSON.stringify({ body: result.body, queries: edge.queries, diagnostics: edge.diagnostics }));
    assert.equal(result.body.sessionId, sessionId);
    assert.equal(result.body.contextSummary.analysisAuthorized, false);
    assert.equal(result.body.contextSummary.structuredRepairCount, 0);
    assert.equal(edge.providerCalls.length, 1);
    assert.equal(edge.providerCalls[0].store, false);
    const input = JSON.parse(edge.providerCalls[0].input.split('\n').slice(1).join('\n'));
    assert.equal(input.contexto.series, 2);
    assert.equal(input.conversa_recente.length, 1);
    assert.equal(JSON.stringify(input).includes('private-student-id'), false);
    assert.equal(edge.queries.some(query => ['studio_tentativas', 'tentativas_avaliacao'].includes(query.table)), false);
    const log = edge.queries.find(query => query.rpc === 'reservar_execucao_copiloto').args;
    assert.equal(log.p_acao, action);
    assert.equal(log.p_professor_id, professor);
    assert.equal(log.p_turma_id, classId);
    assert.equal(log.p_prompt_versao, contract.PROMPT_VERSION);
    assert.equal(JSON.stringify(log.p_solicitacao_resumo).includes('Compare as quantidades'), false);
    assert.equal(edge.queries.find(query => query.mutation?.value.status === 'concluida').mutation.value.tokens_entrada, 12);
    assert.equal(JSON.stringify(result.body).includes('synthetic-service-key'), false);
    if (action === 'gerar_trilha') assert.ok(result.body.suggestion.trail.steps.every(step => Number.isFinite(Number(step.activity.questions[0].answer))));
  }
});

test('generate_activity consolida atividade, prova e diagnóstico no mesmo contrato', async () => {
  for (const [activityType, expectedCategory] of [['activity', 'atividade'], ['exam', 'avaliacao'], ['diagnostic', 'diagnostica']]) {
    const edge = server({ output: { resumo: 'Uma proposta para revisar evidências observáveis.', avisos: [], atividade: activity(1) } });
    const result = await edge.send({ operation: 'generate_activity', action: 'gerar_atividade', generationVariant: 'complete', activityType, questionCount: 1, value: 1, objective: 'Compare dados e justifique uma conclusão verificável.' });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.operation, 'generate_activity');
    assert.equal(result.body.data.activity.category, expectedCategory);
    assert.equal(providerInput(edge.providerCalls[0]).operation, 'generate_activity');
    assert.equal(edge.queries.find(query => query.rpc === 'reservar_execucao_copiloto').args.p_acao, 'gerar_atividade');
    assert.equal(edge.queries.some(query => /publicar|publish/i.test(query.rpc || query.table || '')), false);
  }
  const invalidType = server();
  assert.equal((await invalidType.send({ operation: 'generate_activity', activityType: 'chat' })).status, 400);
  assert.equal(invalidType.providerCalls.length, 0);
});

test('habilidades e descritores são autorizados para série e trimestre obtidos no contexto', async () => {
  const skillId = '50000000-0000-4000-8000-000000000001';
  const generatedActivity = activity(1);
  generatedActivity.questoes[0].habilidade_ids = [skillId];
  const edge = server({ output: { resumo: 'Uma comparação alinhada às evidências curriculares.', avisos: [], atividade: generatedActivity } });
  const result = await edge.send({ operation: 'generate_activity', objective: 'Compare dados e registre uma conclusão verificável.', questionCount: 1, value: 1, trimester: 2, skillIds: [skillId] });
  assert.equal(result.status, 200);
  const curriculumCall = edge.queries.find(query => query.rpc === 'buscar_habilidades_curriculares');
  assert.equal(curriculumCall.args.p_serie, 2);
  assert.equal(curriculumCall.args.p_trimestre, 2);
  assert.equal(providerInput(edge.providerCalls[0]).habilidades[0].descritores[0].codigo, 'D-01');
  const invalidTrimester = server();
  assert.equal((await invalidTrimester.send({ trimester: 4 })).status, 400);
  assert.equal(invalidTrimester.providerCalls.length, 0);
  const invalidSkill = server();
  assert.equal((await invalidSkill.send({ skillIds: ['50000000-0000-4000-8000-000000000099'], trimester: 2 })).status, 400);
  assert.equal(invalidSkill.providerCalls.length, 0);
  const clientSelectedSkills = server({ output: { resumo: 'A turma precisa consolidar a comparação de evidências.', dificuldades_recorrentes: ['Distinguir dado de conclusão.'], recuperacao: { objetivo: 'Comparar dados antes de uma conclusão.', etapas: ['Modelar uma comparação curta.', 'Praticar em novo contexto.'] } } });
  assert.equal((await clientSelectedSkills.send({ operation: 'analyze_class', skillIds: [skillId] })).status, 200);
  assert.equal(clientSelectedSkills.queries.some(query => query.rpc === 'buscar_habilidades_curriculares'), false);
});

test('adapt_question envia somente a questão-alvo e uma ação estruturada', async () => {
  const currentActivity = { title: 'Comparar dados', instructions: 'Leia os dados e calcule a diferença.', duration: 20, value: 2, scoringMode: 'igual', questions: [
    { type: 'calculo', statement: 'Calcule a diferença entre 18 e 7.', alternatives: [], answer: '11', explanation: 'Subtraia sete de dezoito.', points: 1, skillIds: [] },
    { type: 'calculo', statement: 'Calcule a diferença entre 25 e 9.', alternatives: [], answer: '16', explanation: 'Subtraia nove de vinte e cinco.', points: 1, skillIds: [] },
  ] };
  for (const [adaptation, instruction] of [['simplify', /Simplifique apenas/], ['increase_difficulty', /Aumente moderadamente/], ['alternative', /questão alternativa/]]) {
    const edge = server({ output: { resumo: 'A questão foi adaptada sem mudar o objetivo.', avisos: [], atividade: activity(1) } });
    const result = await edge.send({ operation: 'adapt_question', action: 'revisar_atividade', adaptation, questionIndex: 1, currentActivity, objective: '' });
    assert.equal(result.status, 200);
    assert.equal(result.body.operation, 'adapt_question');
    assert.equal(result.body.data.activity.questions.length, 1);
    const input = providerInput(edge.providerCalls[0]);
    assert.equal(input.questao_alvo.statement, currentActivity.questions[1].statement);
    assert.equal(input.atividade_atual, null);
    assert.equal(input.contexto.adaptation, adaptation);
    assert.match(edge.providerCalls[0].system_instruction, instruction);
    assert.equal(edge.providerCalls[0].response_format.schema.properties.atividade.properties.questoes.minItems, 1);
    assert.equal(JSON.stringify(edge.queries.find(query => query.rpc === 'reservar_execucao_copiloto').args).includes('Calcul'), false);
    assert.equal(edge.queries.some(query => /publicar|publish/i.test(query.rpc || query.table || '')), false);
  }
  const invalidIndex = server();
  assert.equal((await invalidIndex.send({ operation: 'adapt_question', adaptation: 'simplify', questionIndex: 9, currentActivity, objective: '' })).status, 400);
  assert.equal(invalidIndex.providerCalls.length, 0);
});

test('analyze_class usa RPC autorizada, entrega agregados e requer evidência suficiente', async () => {
  const analysis = { resumo: 'A turma demonstra dificuldade em comparar evidências.', dificuldades_recorrentes: ['Confundir observação com conclusão.'], recuperacao: { objetivo: 'Comparar dados antes de justificar uma conclusão.', etapas: ['Modelar a leitura de uma tabela curta com a turma.', 'Praticar em pares usando dados de um novo contexto.'] } };
  const edge = server({ output: analysis });
  const result = await edge.send({ operation: 'analyze_class', action: 'sugerir_recuperacao', objective: 'Não persistir este texto livre: nome de estudante fictício.' });
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.operation, 'analyze_class');
  assert.equal(result.body.data.criticalSkills[0].performancePercent, 42);
  assert.deepEqual(result.body.data.recurringDifficulties, analysis.dificuldades_recorrentes);
  const provider = providerInput(edge.providerCalls[0]);
  assert.equal(provider.resultados_agregados.habilidadesCriticas[0].code, 'HAB-01');
  assert.equal(JSON.stringify(provider).includes('Nome de estudante'), false);
  assert.equal(JSON.stringify(edge.queries.find(query => query.rpc === 'reservar_execucao_copiloto').args).includes('nome de estudante'), false);
  assert.equal(edge.queries.some(query => ['tentativas_avaliacao', 'respostas_avaliacao'].includes(query.table)), false);
  assert.equal(edge.queries.some(query => /publicar|publish/i.test(query.rpc || query.table || '')), false);

  const insufficient = server({ analysisData: { activityCount: 0, correctedAttemptCount: 0, criticalSkills: [] } });
  const blocked = await insufficient.send({ operation: 'analyze_class', objective: '' });
  assert.equal(blocked.status, 422);
  assert.equal(insufficient.providerCalls.length, 0);
});

test('analyze_class trata JSON incompleto do Gemini sem retornar conteúdo inválido', async () => {
  const edge = server({ output: { resumo: 'Resposta parcial.' } });
  const result = await edge.send({ operation: 'analyze_class', objective: '' });
  assert.equal(result.status, 502);
  assert.equal(result.body.success, false);
  assert.match(result.body.error.message, /dificuldade recorrente/);
  assert.equal(edge.providerCalls.length, 2);
  assert.equal(JSON.stringify(result.body).includes('Resposta parcial.'), false);
  assert.equal(edge.queries.some(query => query.table === 'copiloto_execucoes' && query.mutation?.value.status === 'concluida'), false);
});

test('Professor B, usuário sem sessão e ação de publicação são bloqueados', async () => {
  const foreign = server({ professorId: '10000000-0000-4000-8000-000000000002' });
  assert.equal((await foreign.send({ operation: 'generate_activity' })).status, 403);
  assert.equal(foreign.providerCalls.length, 0);
  const anonymous = server({ authenticated: false });
  assert.equal((await anonymous.send({ operation: 'generate_activity' })).status, 401);
  assert.equal(anonymous.providerCalls.length, 0);
  assert.equal((await server().send({ operation: 'publish_activity' })).status, 400);
});

test('compatibilidade com schema rejeitado mantém currículo, validação e o mesmo limite de tempo', async () => {
  // Matches the production Interactions error envelope observed on 2026-10-04.
  const rejected = { status: 400, body: { error: { code: 'invalid_request', message: 'Request contains an invalid argument.' } } };
  const accepted = { body: { output_text: JSON.stringify({ resumo: 'Uma divisão com verificação do resultado.', avisos: [], atividade: activity(1) }) } };
  const edge = server({ providerResponses: [rejected, accepted] });
  const result = await edge.send({ action: 'gerar_atividade', questionCount: 1, duration: 10, value: 1 });
  assert.equal(result.status, 200);
  assert.equal(edge.providerCalls.length, 2);
  assert.equal(edge.providerCalls[0].response_format.schema.properties.atividade.properties.questoes.items.properties.habilidade_ids.maxItems, 0);
  assert.equal('maxItems' in edge.providerCalls[1].response_format.schema.properties.atividade.properties.questoes.items.properties.habilidade_ids, false);
  assert.deepEqual(edge.providerCalls[1].response_format.schema.properties.atividade.properties.questoes.items.properties.tipo.enum, contract.QUESTION_TYPES);
  const secondInput = JSON.parse(edge.providerCalls[1].input.split('\n').slice(1).join('\n'));
  assert.equal(secondInput.contrato_saida.properties.atividade.properties.questoes.minItems, 1);
  assert.equal(edge.providerSignals[0], edge.providerSignals[1]);
  assert.equal(result.body.contextSummary.providerSchemaFallbackCount, 1);
  assert.deepEqual(result.body.suggestion.activity.questions[0].skillIds, []);
  assert.equal(edge.queries.find(query => query.mutation?.value.status === 'concluida').mutation.value.solicitacao_resumo.providerSchemaFallbackCount, 1);
  assert.equal(JSON.stringify(result.body).includes('synthetic provider internal diagnostic'), false);
});

test('compatibilidade reconhece envelopes Interactions e RPC somente em HTTP 400', async () => {
  for (const field of [{ code: 'invalid_argument' }, { type: 'invalid_request_error' }, { status: 'INVALID_ARGUMENT' }]) {
    const edge = server({ providerResponses: [ { status: 400, body: { error: field } }, { body: { output_text: JSON.stringify(ideas) } } ] });
    assert.equal((await edge.send()).status, 200);
    assert.equal(edge.providerCalls.length, 2);
  }
  const denied = server({ providerResponses: [{ status: 403, body: { error: { code: 'invalid_request' } } }] });
  assert.equal((await denied.send()).status, 503);
  assert.equal(denied.providerCalls.length, 1);
  const persistent = server({ providerResponses: [{ status: 400, body: { error: { code: 'invalid_request' } } }] });
  const result = await persistent.send();
  assert.equal(result.body.errorCode, 'provider_invalid_request');
  assert.equal(persistent.providerCalls.length, 2);
});

test('fallback de schema não permite aprovar gabaritos inválidos e não se repete no reparo pedagógico', async () => {
  const invalid = activity(1); invalid.questoes[0].resposta = 'não é um número';
  const edge = server({ providerResponses: [
    { status: 400, body: { error: { status: 'INVALID_ARGUMENT' } } },
    { body: { output_text: JSON.stringify({ resumo: 'Uma divisão com verificação do resultado.', avisos: [], atividade: invalid }) } },
  ] });
  const result = await edge.send({ action: 'gerar_atividade', questionCount: 1, duration: 10, value: 1 });
  assert.equal(result.status, 502);
  assert.equal(edge.providerCalls.length, 3);
  assert.equal('maxItems' in edge.providerCalls[2].response_format.schema.properties.atividade.properties.questoes, false);
  const repairInput = JSON.parse(edge.providerCalls[2].input.split('\n').slice(1).join('\n'));
  assert.match(repairInput.correcao_validacao.erro, /numéric|número/);
  assert.equal(edge.queries.some(query => query.mutation?.value.status === 'concluida'), false);
  assert.equal(edge.queries.find(query => query.mutation?.value.status === 'falhou').mutation.value.solicitacao_resumo.providerSchemaFallbackCount, 1);
});

test('diagnóstico do provedor registra HTTP e campos conhecidos sem mensagens, prompts ou segredos', async () => {
  const edge = server({ providerResponses: [{ status: 400, body: { error: {
    status: 'INVALID_ARGUMENT', code: 400, type: 'private-student-id',
    message: 'Invalid JSON payload received. Unknown name "system_instruction": cannot find field. input="private-student-name" key=synthetic-model-key',
  } } }] });
  const result = await edge.send();
  assert.equal(result.status, 503);
  assert.equal(edge.diagnostics.length, 2);
  assert.equal(edge.diagnostics[0].event, 'copilot_provider_failure');
  assert.equal(edge.diagnostics[0].httpStatus, 400);
  assert.equal(edge.diagnostics[0].status, 'INVALID_ARGUMENT');
  assert.equal(edge.diagnostics[0].code, 400);
  assert.equal(edge.diagnostics[0].type, 'unclassified');
  assert.equal(edge.diagnostics[0].reason, 'unknown_field');
  assert.ok(edge.diagnostics[0].fields.includes('system_instruction'));
  assert.equal(edge.diagnostics[0].requestId, result.body.requestId);
  assert.deepEqual(edge.diagnostics.map(item => item.schemaFallbackCount), [0, 1]);
  assert.equal(/private-student|synthetic-model-key|message|prompt/.test(JSON.stringify(edge.diagnostics)), false);
});

test('falha persistente ou credencial do provedor gera diagnóstico seguro sem tentativas inúteis', async () => {
  for (const [status, expectedCalls, errorCode] of [[400, 2, 'provider_invalid_request'], [401, 1, 'provider_configuration'], [403, 1, 'provider_configuration'], [404, 1, 'provider_configuration']]) {
    const edge = server({ providerResponses: [{ status, body: { error: { status: 'INVALID_ARGUMENT', message: 'synthetic provider secret key details' } } }] });
    const result = await edge.send();
    assert.equal(result.status, 503);
    assert.equal(edge.providerCalls.length, expectedCalls);
    assert.equal(result.body.errorCode, errorCode);
    assert.equal(result.body.retryable, false);
    assert.equal(JSON.stringify(result.body).includes('synthetic provider secret'), false);
    assert.equal(edge.queries.find(query => query.mutation?.value.status === 'falhou').mutation.value.codigo_erro, errorCode);
  }
});

test('resposta Interactions em blocos de texto anteriores continua utilizável', async () => {
  const json = JSON.stringify(ideas); const split = Math.floor(json.length / 2);
  const edge = server({ providerResponses: [{ body: { outputs: [ { type: 'thought', text: 'Não enviar raciocínio.' }, { type: 'text', text: json.slice(0, split) }, { type: 'text', text: json.slice(split) } ] } }] });
  const result = await edge.send();
  assert.equal(result.status, 200);
  assert.equal(result.body.suggestion.ideas.length, 3);
  assert.equal(edge.providerCalls.length, 1);
  assert.equal(JSON.stringify(result.body).includes('raciocínio'), false);
});

test('handler não revela erros internos e retorna códigos úteis para validade, timeout e quota', async () => {
  const internal = await server({ internalError: 'synthetic-service-key at private-query.example' }).send();
  assert.equal(internal.status, 503);
  assert.equal(JSON.stringify(internal.body).includes('synthetic-service-key'), false);
  assert.equal((await server().send({ action: 'publicar_automaticamente' })).status, 400);
  assert.equal((await server({ profileRole: 'aluno' }).send()).status, 403);
  const limited = server({ providerStatus: 429 }); assert.equal((await limited.send()).status, 429); assert.equal(limited.providerCalls.length, 1);
  const timeout = new Error('synthetic raw timeout'); timeout.name = 'TimeoutError';
  const stalled = server({ providerError: timeout }); const response = await stalled.send();
  assert.equal(response.status, 504); assert.equal(stalled.providerCalls.length, 1);
  assert.equal(JSON.stringify(response.body).includes('synthetic raw timeout'), false);
  const quota = server({ budgetCount: 5 }); assert.equal((await quota.send()).status, 429); assert.equal(quota.providerCalls.length, 0);
});

test('revisão de trilha delimita a etapa ativa, sem prometer alterar o percurso completo', async () => {
  const original = contract.normalizeTeacherSuggestion(trail, new Set(), { category: 'atividade', duration: 20, totalValue: 2 }, contract.QUESTION_TYPES, 2, 'gerar_trilha');
  const edge = server({ output: { resumo: 'A etapa recebeu uma resolução com verificação explícita.', avisos: [], atividade: activity(1) } });
  const result = await edge.send({ action: 'revisar_atividade', currentActivity: original.trail.steps[0].activity, currentSuggestion: original, questionCount: 1, duration: 10, value: 1 });
  assert.equal(result.status, 200);
  assert.equal(result.body.suggestion.activity.questions.length, 1);
  assert.match(result.body.suggestion.warnings[0], /etapa ativa/);
  const input = JSON.parse(edge.providerCalls[0].input.split('\n').slice(1).join('\n'));
  assert.equal(input.escopo_revisao, 'etapa_ativa_da_trilha');
  assert.equal(input.sugestao_anterior.trail.steps.length, 2);
  assert.match(edge.providerCalls[0].system_instruction, /sem afirmar que revisou a trilha inteira/);
});

const providerInput = call => JSON.parse(call.input.split('\n').slice(1).join('\n'));
const proposal = (count, type = 'calculo') => {
  const complete = activity(1);
  complete.valor_total = count;
  complete.questoes = Array.from({ length: count }, (_, index) => {
    const question = activity(index + 1).questoes[0]; question.tipo = type;
    if (type === 'unica_escolha') { question.alternativas = [question.resposta, String(Number(question.resposta) + 1), String(Number(question.resposta) + 2)]; }
    return question;
  });
  return { resumo: 'Uma proposta curta com dados concretos, resposta verificável e feedback explicativo.', avisos: [], atividade: complete };
};

test('Acesso Total padrão respeita quantidade e formatos explícitos do pedido atual', async () => {
  const edge = server({ output: proposal(7, 'unica_escolha') });
  const result = await edge.send({ action: 'gerar_atividade', objective: 'Crie sete questões de múltipla escolha para comparar quantidades.', questionCount: 2, questionTypes: ['calculo'], value: 7 });
  assert.equal(result.status, 200);
  const input = providerInput(edge.providerCalls[0]);
  assert.equal(input.contexto.fullAccess, true);
  assert.equal(input.contexto.questionCount, 7);
  assert.equal(input.contexto.quantitySource, 'pedido_professor');
  assert.deepEqual(input.contexto.questionTypes, ['unica_escolha']);
  assert.equal(result.body.contextSummary.questionCount, 7);
  assert.deepEqual(edge.providerCalls[0].response_format.schema.properties.atividade.properties.questoes.items.properties.tipo.enum, ['unica_escolha']);
  assert.equal(edge.providerCalls[0].generation_config.max_output_tokens, 12400);
  assert.equal(edge.providerCalls[0].store, false);
  assert.equal(result.body.contextSummary.provider, 'google-gemini');
  assert.equal(result.body.contextSummary.providerConfirmed, true);
  assert.deepEqual(result.body.contextSummary.providerUsage, { inputTokens: 12, outputTokens: 18 });
});

test('pedido mais recente vence quantidade antiga, e Acesso Total desligado preserva controles', async () => {
  const latest = server({ output: proposal(3, 'resposta_curta') });
  const result = await latest.send({ action: 'gerar_atividade', objective: 'Crie sete questões de múltipla escolha para comparar quantidades.', messages: [{ role: 'user', content: 'Faça três questões de resposta curta com um alvo único por enunciado.' }], questionCount: 2, value: 3 });
  assert.equal(result.status, 200);
  assert.equal(providerInput(latest.providerCalls[0]).contexto.questionCount, 3);
  assert.deepEqual(providerInput(latest.providerCalls[0]).contexto.questionTypes, ['resposta_curta']);
  const manual = server({ output: proposal(2) });
  assert.equal((await manual.send({ action: 'gerar_atividade', fullAccess: false, objective: 'Crie sete questões de múltipla escolha para comparar quantidades.', questionTypes: ['calculo'], questionCount: 2 })).status, 200);
  const controls = providerInput(manual.providerCalls[0]).contexto;
  assert.equal(controls.fullAccess, false);
  assert.equal(controls.questionCount, 2);
  assert.deepEqual(controls.questionTypes, ['calculo']);
});

test('quantidade explícita permanece limitada pela conta sem afrouxar a validação', async () => {
  const bounded = server({ output: proposal(4), configuration: { max_questoes: 4 } });
  const result = await bounded.send({ action: 'gerar_atividade', objective: 'Crie doze questões para comparar quantidades em situações familiares.', value: 4 });
  assert.equal(result.status, 200);
  assert.equal(result.body.contextSummary.questionCount, 4);
  assert.match(result.body.suggestion.warnings[0], /limite de 4 questões/);
  const invalid = server({ output: proposal(2), configuration: { max_questoes: 4 } });
  const denied = await invalid.send({ action: 'gerar_atividade', objective: 'Crie quatro questões para comparar quantidades em situações familiares.', value: 4 });
  assert.equal(denied.status, 502);
  assert.equal(invalid.queries.some(query => query.table === 'copiloto_sessoes' && query.mutation?.kind === 'update'), false);
});

test('panorama automático usa agregados apenas quando autorizado e relevante', async () => {
  for (const [objective, useClassContext, expected] of [
    ['Criar uma investigação com dados e conclusão verificável.', true, false],
    ['Adaptar uma investigação ao desempenho e às dificuldades da turma.', true, true],
    ['Adaptar uma investigação ao desempenho e às dificuldades da turma.', false, false],
  ]) {
    const edge = server(); const result = await edge.send({ objective, fullAccess: true, classContextMode: 'auto', useClassContext });
    assert.equal(result.status, 200);
    assert.equal(result.body.contextSummary.analysisUsed, expected);
    assert.equal(result.body.contextSummary.analysisAuthorized, expected);
    assert.equal(edge.queries.some(query => query.table === 'avaliacoes_docentes'), expected);
    assert.equal(edge.queries.some(query => ['alunos', 'respostas_avaliacao', 'studio_respostas'].includes(query.table)), false);
  }
});

test('memória persistente guarda somente metadados de operação e ignora conteúdo livre histórico', async () => {
  const legacyMemory = { version: 1, turnCount: 9, turns: [{ action: 'gerar_ideias', intent: 'private-student-name', outcome: 'private answer' }] };
  const edge = server({ session: { id: sessionId, contexto: { existingSetting: 'keep', conversationMemory: legacyMemory } } });
  const result = await edge.send({ sessionId, conversationMemory: { summary: 'forged-browser-memory' }, messages: [{ role: 'user', content: 'Mantenha as cores e troque o contexto para uma feira escolar.' }] });
  assert.equal(result.status, 200);
  const input = providerInput(edge.providerCalls[0]);
  assert.equal(input.memoria_conversa, null);
  assert.equal(/private-student-name|private answer|forged-browser-memory/.test(JSON.stringify(input)), false);
  assert.equal(result.body.contextSummary.memoryUsed, false);
  assert.equal(result.body.contextSummary.memoryPersisted, true);
  assert.equal(result.body.conversationMemory.version, 2);
  assert.equal(result.body.conversationMemory.turnCount, 1);
  const read = edge.queries.find(query => query.table === 'copiloto_sessoes' && !query.mutation);
  const write = edge.queries.find(query => query.table === 'copiloto_sessoes' && query.mutation?.kind === 'update');
  const filters = [['id', sessionId], ['professor_id', professor], ['turma_id', classId], ['materia_codigo', 'matematica']];
  assert.deepEqual(read.filters, filters); assert.deepEqual(write.filters, filters);
  const saved = write.mutation.value.contexto;
  assert.equal(saved.existingSetting, 'keep');
  assert.equal(saved.conversationMemory, legacyMemory, 'O contexto histórico v1 é preservado sem ser reutilizado.');
  assert.equal(saved.conversationMemoryV2.turns.length, 1);
  assert.equal(JSON.stringify(saved.conversationMemoryV2).includes('private-student-name'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.conversationMemoryV2.turns[0])), { intent: 'gerar_ideias', outcome: 'Rascunho validado', title: 'Sugestão pedagógica', action: 'gerar_ideias' });
  const second = await edge.send({ sessionId, messages: [{ role: 'user', content: 'Agora preserve a feira e deixe os números menores.' }] });
  assert.equal(second.status, 200);
  assert.equal(providerInput(edge.providerCalls[1]).memoria_conversa.summary, 'Pedido: gerar_ideias\nResultado: Sugestão pedagógica. Rascunho validado');
  assert.equal(second.body.conversationMemory.turnCount, 2);
});

test('sessão ausente ou erro de leitura não reutiliza memória externa e falha não sobrescreve resumo', async () => {
  const absent = server({ session: null });
  assert.equal((await absent.send({ sessionId, conversationMemory: { summary: 'foreign-class-memory' } })).status, 200);
  assert.equal(providerInput(absent.providerCalls[0]).memoria_conversa, null);
  assert.equal(absent.queries.filter(query => query.table === 'copiloto_sessoes' && query.mutation?.kind === 'insert').length, 1);
  const unavailable = server({ sessionReadError: 'synthetic-service-key private database detail' });
  const result = await unavailable.send({ sessionId });
  assert.equal(result.status, 503);
  assert.equal(unavailable.providerCalls.length, 0);
  assert.equal(JSON.stringify(result.body).includes('synthetic-service-key'), false);
  const failed = server({ providerStatus: 403 });
  assert.equal((await failed.send({ sessionId })).status, 503);
  assert.equal(failed.queries.some(query => query.table === 'copiloto_sessoes' && query.mutation?.kind === 'update'), false);
});

test('falha ao guardar memória mantém o rascunho validado e informa continuidade indisponível', async () => {
  const edge = server({ memoryWriteError: 'private-storage-detail synthetic-service-key' });
  const result = await edge.send();
  assert.equal(result.status, 200);
  assert.equal(result.body.suggestion.ideas.length, 3);
  assert.equal(result.body.contextSummary.memoryPersisted, false);
  assert.equal(edge.queries.find(query => query.mutation?.value.status === 'concluida').mutation.value.status, 'concluida');
  assert.deepEqual(edge.diagnostics, [{ event: 'copilot_memory_not_saved', requestId: result.body.requestId }]);
  assert.equal(/private-storage-detail|synthetic-service-key/.test(JSON.stringify(result.body)), false);
});

test('prova protegida e dificuldade média chegam ao Gemini com segurança aplicada pelo servidor', async () => {
  const edge = server({ output: proposal(1) });
  const result = await edge.send({ action: 'gerar_atividade', questionCount: 1, value: 1, secureExam: true, category: 'atividade', difficulty: 'equilibrada' });
  assert.equal(result.status, 200);
  assert.equal(providerInput(edge.providerCalls[0]).contexto.category, 'avaliacao');
  assert.equal(result.body.suggestion.activity.category, 'avaliacao');
  assert.equal(result.body.suggestion.activity.configuration.secureExam.enabled, true);
  assert.equal(result.body.suggestion.activity.configuration.learningSupport.hints, false);
  assert.equal(result.body.suggestion.activity.immediateFeedback, false);
  assert.equal(result.body.suggestion.activity.showAnswerKey, false);
  assert.match(edge.providerCalls[0].system_instruction, /média acessível/);
  assert.match(edge.providerCalls[0].system_instruction, /no máximo duas etapas simples/);
  assert.match(edge.providerCalls[0].system_instruction, /prova protegida/);
  assert.match(edge.providerCalls[0].system_instruction, /campos privados do professor/);
});
