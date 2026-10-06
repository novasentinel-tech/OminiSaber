const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync('backend/ominisaber-manager-client.js', 'utf8');
let update, rpcArgs, failure = null;
const query = {
  update(value) { update = value; return this; },
  eq() { return this; }, select() { return this; },
  async single() { return { data: { id: 'test' }, error: failure }; }
};
const api = {
  client: { from: () => query, rpc: async (...args) => { rpcArgs = args; return { error: failure }; } },
  getSession: async () => ({ user: { id: 'manager' } }),
  getProfile: async () => ({ role: 'gestor' })
};
vm.runInNewContext(source, { window: { OminiSaber: api } });
(async () => {
  await api.updateManagerDescriptor('test', { titulo: 'Título', descricao: 'Descrição', status: 'revisao', codigo: 'D001_P', materia_codigo: 'quimica', serie: 2, updated_at: '2026-01-01' });
  assert.deepEqual(Object.keys(update).sort(), ['descricao','status','titulo','updated_at']);
  assert.ok(Number.isFinite(Date.parse(update.updated_at)));
  failure = { code: 'PGRST116' };
  await assert.rejects(api.updateManagerDescriptor('test', {}), /Recarregue/);
  failure = { code: 'PGRST202' };
  await assert.rejects(api.saveManagerDescriptorsBatch([{ codigo: 'D001_P' }]), /precisa ser implantada/);
  assert.equal(rpcArgs[0], 'salvar_descritores_curriculares_lote');
  assert.equal(rpcArgs[1].p_descritores[0].codigo, 'D001_P');
  api.getProfile = async () => ({ role: 'aluno' });
  await assert.rejects(api.updateManagerDescriptor('test', {}), /exclusivo do gestor/);
  console.log('PASS: preserved links, update timestamp, conflict handling, RPC payload, missing migration, manager guard.');
})().catch(error => { console.error(error); process.exitCode = 1; });
