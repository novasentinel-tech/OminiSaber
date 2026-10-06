import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source = fs.readFileSync(new URL('../ominisaber-supabase-client.js', import.meta.url), 'utf8');

function browserClient({ response, message = 'Edge Function returned a non-2xx status code', data } = {}) {
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'synthetic-professor' } } }, error: null }) },
    functions: { invoke: async () => ({ data, error: data ? null : { context: response, message } }) },
  };
  const window = {
    OMINISABER_SUPABASE_CONFIG: { url: 'https://synthetic.invalid', anonKey: 'synthetic-public-key' },
    supabase: { createClient: () => client },
    location: { pathname: '/frontend/professor/professor_portugues/avaliacoes/index.html' },
    addEventListener() {},
  };
  vm.runInNewContext(source, { window, document: {}, Error });
  return window.OminiSaber;
}

test('503 com diagnóstico JSON seguro preserva motivo real e controles de nova tentativa', async () => {
  const payload = { error: 'A integração de IA precisa de um ajuste no servidor. Seu pedido foi preservado.', errorCode: 'provider_configuration', retryable: false, requestId: 'synthetic-request' };
  const response = new Response(JSON.stringify(payload), { status: 503 });
  await assert.rejects(browserClient({ response }).requestTeacherCopilot({ objective: 'Pedido de teste.' }), error => {
    assert.equal(error.message, payload.error);
    assert.equal(error.code, 'provider_configuration');
    assert.equal(error.retryable, false);
    assert.equal(error.requestId, 'synthetic-request');
    assert.equal(error.status, 503);
    assert.doesNotMatch(error.message, /precisa ser publicada|reiniciada/);
    return true;
  });
  assert.deepEqual(await response.json(), payload, 'A leitura do diagnóstico não consome a resposta original.');
});

test('mensagem válida em JSON prevalece sobre status genérico e mensagem do SDK', async () => {
  for (const status of [400, 401, 429, 503]) {
    const response = new Response(JSON.stringify({ error: {}, message: 'O pedido precisa de uma turma vinculada.' }), { status });
    await assert.rejects(browserClient({ response }).requestTeacherCopilot({}), /O pedido precisa de uma turma vinculada\./);
  }
  const canonical = new Response(JSON.stringify({ success: false, operation: 'adapt_question', error: { code: 'question_required', message: 'Selecione a questão que deseja adaptar.' } }), { status: 400 });
  await assert.rejects(browserClient({ response: canonical }).requestTeacherCopilot({}), error => {
    assert.equal(error.message, 'Selecione a questão que deseja adaptar.');
    assert.equal(error.code, 'question_required');
    return true;
  });
});

test('HTML, JSON inválido ou diagnóstico sem texto recebem mensagem correta sem supor falta de deploy', async () => {
  for (const body of ['<html>Gateway unavailable</html>', '{', JSON.stringify({ error: {} }), JSON.stringify({ error: ' ' })]) {
    const response = new Response(body, { status: 503 });
    await assert.rejects(browserClient({ response }).requestTeacherCopilot({}), error => {
      assert.match(error.message, /temporariamente indisponível/);
      assert.doesNotMatch(error.message, /publicada|reiniciada|Gateway|\[object Object\]|Edge Function/);
      return true;
    });
  }
});

test('falha de transporte é distinguida de resposta do servidor e sucesso continua intacto', async () => {
  await assert.rejects(browserClient({ message: 'Failed to send a request to the Edge Function' }).requestTeacherCopilot({}), /Não foi possível conectar ao Copiloto/);
  const payload = { suggestion: { summary: 'Proposta pronta para revisão.', ideas: [] }, executionId: 'synthetic-execution' };
  assert.equal(await browserClient({ data: payload }).requestTeacherCopilot({}), payload);
});
