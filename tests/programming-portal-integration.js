const output = document.querySelector('#results');
const frame = document.querySelector('#fixture');
const trigger = document.querySelector('#run');
const results = [];
const nonce = Date.now().toString(36);
const check = (condition, message) => {
  if (!condition) throw new Error(message);
  results.push('OK · ' + message); output.textContent = results.join('\n');
};
const waitFor = async (read, message, timeout = 12000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = read(); if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error(message);
};
const openFixture = async (scene, query = {}) => {
  const parameters = new URLSearchParams({ scene, nonce, ...query });
  frame.src = './programming-portal-fixture.html?' + parameters;
  await waitFor(() => frame.contentWindow?.programmingFixture?.requestKey === parameters.toString(), 'Fixture não carregou: ' + scene);
  return { window: frame.contentWindow, document: frame.contentDocument };
};
async function run() {
  results.length = 0; output.textContent = 'Verificando…'; trigger.disabled = true;
  try {
    const assets = [
      '/frontend/shared/programming-lab/programming-lab.js',
      '/frontend/shared/programming-lab/programming-lab.css',
      '/frontend/shared/programming-lab/learning-tracks.js',
      '/frontend/shared/programming-lab/learning-progress.js',
      '/frontend/shared/programming-lab/runtime.js',
    ];
    for (const path of assets) {
      const response = await fetch(path); check(response.ok, 'Asset disponível: ' + path);
    }
    let fixture = await openFixture('teacher', { language: 'cpp', lesson: 'estufa' });
    await waitFor(() => fixture.document.querySelector('[data-pl-assign]'), 'Laboratório docente não montou');
    check(fixture.document.querySelector('[data-pl-language="cpp"]').getAttribute('aria-pressed') === 'true', 'Professor abre a linguagem do link');
    check(fixture.document.querySelector('.pl-lesson h2').textContent.includes('Guardião da estufa'), 'Professor abre a etapa do link');
    check(fixture.window.programmingFixture.calls.filter(call => call.name === 'createTeacherLab').length === 0, 'Abrir o laboratório não grava nem publica');
    fixture.document.querySelector('[data-pl-assign]').click();
    const form = fixture.document.querySelector('[data-lab-form]');
    check(fixture.document.querySelector('.pl-teacher-publish').open, 'Preparar atividade abre a orientação da turma');
    check(form.elements.title.value === 'Projeto 2 · Guardião da estufa · C++', 'Título deriva da etapa escolhida');
    check(form.elements.format.value === 'desafio_codigo', 'Formato é desafio de código');
    check(form.elements.configValue.value === 'C++20 no navegador', 'Ambiente é C++ real');
    const match = form.elements.description.value.match(/Abra a prática: (\S+)/);
    const studentLink = match && new URL(match[1]);
    check(studentLink?.pathname === '/frontend/aluno/modulo_de_trilhas/ide/index.html' && studentLink.searchParams.get('language') === 'cpp' && studentLink.searchParams.get('lesson') === 'estufa', 'Orientação aponta à mesma linguagem e etapa no aluno');
    check(fixture.window.programmingFixture.calls.filter(call => call.name === 'createTeacherLab').length === 0, 'Preparar atividade preenche o formulário sem publicar');
    form.elements.classId.value = 'fixture-class';
    form.requestSubmit(form.querySelector('[name="intent"][value="draft"]'));
    await waitFor(() => fixture.window.programmingFixture.calls.some(call => call.name === 'createTeacherLab'), 'Rascunho não foi enviado à API fictícia');
    const payload = fixture.window.programmingFixture.calls.find(call => call.name === 'createTeacherLab').args[0];
    check(payload.publish === false && payload.classId === 'fixture-class', 'Salvar rascunho preserva a turma e publish=false');
    check(payload.configuration.programming_language === 'cpp' && payload.configuration.programming_lesson === 'estufa' && payload.configuration.stack === 'C++20 no navegador', 'Payload do laboratório preserva linguagem, etapa e stack');
    check(payload.tipoProfessor === 'tecnico_informatica' && payload.format === 'desafio_codigo', 'Payload usa especialidade e formato corretos');
    check(fixture.window.programmingFixture.errors.length === 0, 'Fluxo docente sem exceções de integração');

    await waitFor(() => fixture.document.querySelector('[data-lab-form]') !== form && fixture.document.querySelector('[data-pl-assign]'), 'Laboratório não remontou após salvar o rascunho');
    fixture.document.querySelector('[data-pl-assign]').click();
    const networkForm = fixture.document.querySelector('[data-lab-form]');
    networkForm.elements.title.value = 'Rede local inventada para teste';
    networkForm.elements.description.value = 'Planeje uma rede fictícia e explique como testar a conexão.';
    networkForm.elements.format.value = 'laboratorio_redes';
    networkForm.elements.configValue.value = 'Ethernet fictícia';
    networkForm.elements.classId.value = 'fixture-class';
    networkForm.requestSubmit(networkForm.querySelector('[name="intent"][value="draft"]'));
    await waitFor(() => fixture.window.programmingFixture.calls.filter(call => call.name === 'createTeacherLab').length === 2, 'Rascunho de outro formato não foi enviado à API fictícia');
    const networkPayload = fixture.window.programmingFixture.calls.filter(call => call.name === 'createTeacherLab')[1].args[0];
    check(networkPayload.format === 'laboratorio_redes' && networkPayload.publish === false && networkPayload.configuration.stack === 'Ethernet fictícia', 'Outro formato salva rascunho com seu próprio ambiente');
    check(!Object.hasOwn(networkPayload.configuration, 'programming_language') && !Object.hasOwn(networkPayload.configuration, 'programming_lesson'), 'Trocar para redes remove a associação à linguagem e etapa de programação');

    fixture = await openFixture('ide', { language: 'cpp', lesson: 'estufa' });
    await waitFor(() => fixture.document.querySelector('[data-pl-code]'), 'IDE do aluno não montou');
    check(fixture.document.querySelector('[data-pl-language="cpp"]').getAttribute('aria-pressed') === 'true', 'Aluno recebe C++ pelo link preparado');
    check(fixture.document.querySelector('.pl-lesson h2').textContent.includes('Guardião da estufa'), 'Aluno recebe a mesma etapa do professor');
    check(fixture.document.querySelector('[data-pl-code]').getAttribute('aria-label') === 'Editor de código C++', 'Editor tem nome acessível da linguagem');
    check(!fixture.document.querySelector('[data-pl-assign]'), 'Aluno não recebe ação de publicação docente');
    check(fixture.window.programmingFixture.calls.some(call => call.name === 'getProfile' && call.args[0] === fixture.window.programmingFixture.fixtureUser), 'Aluno hidrata o perfil fictício antes de montar a prática');
    check(!fixture.document.querySelector('[data-pseudo-editor]'), 'IDE padrão usa o ambiente de programação');
    check(fixture.window.programmingFixture.errors.length === 0, 'Fluxo de IDE do aluno sem exceções de integração');

    fixture = await openFixture('ide', { language: 'python', lesson: 'dicionarios' });
    await waitFor(() => fixture.document.querySelector('[data-pl-code]'), 'IDE Python não montou');
    check(fixture.document.querySelector('[data-pl-language="python"]').getAttribute('aria-pressed') === 'true' && fixture.document.querySelector('.pl-lesson h2').textContent === 'Encontre dados pelo nome', 'Aluno abre Python e uma etapa específica');

    for (const scene of ['catalog-empty', 'catalog-full']) {
      fixture = await openFixture(scene, { materia: 'tecnico_informatica' });
      await waitFor(() => fixture.document.querySelector('.pl-catalog-launch'), 'Lançamento de programação ausente em ' + scene);
      const links = [...fixture.document.querySelectorAll('.pl-catalog-launch a')];
      check(links.length === 2 && new URL(links[0].href).searchParams.get('language') === 'python' && new URL(links[1].href).searchParams.get('language') === 'cpp', 'Catálogo ' + scene + ' oferece Python e C++');
      check(fixture.document.querySelectorAll('.trail-card').length === (scene === 'catalog-full' ? 1 : 0), 'Catálogo ' + scene + ' preserva o estado real dos conteúdos publicados');
      check(fixture.window.programmingFixture.errors.length === 0, 'Catálogo ' + scene + ' sem exceções');
    }
    fixture = await openFixture('catalog-other', { materia: 'matematica' });
    await waitFor(() => fixture.document.querySelector('.page-heading'), 'Catálogo de outra matéria não montou');
    check(!fixture.document.querySelector('.pl-catalog-launch'), 'Catálogo de outra matéria não recebe lançamento de Informática');

    fixture = await openFixture('pseudo', { mode: 'pseudo', atividade: 'fixture-activity' });
    await waitFor(() => fixture.document.querySelector('[data-pseudo-editor]'), 'Modo de pseudocódigo não montou');
    check(!fixture.document.querySelector('[data-pl-code]'), 'mode=pseudo preserva o editor anterior');
    check(fixture.document.querySelector('.ide-reference-panel[data-reference-panel="lesson"]').textContent.includes('Material inventado'), 'Pseudocódigo mantém o material da aula de origem');
    check(fixture.window.programmingFixture.errors.length === 0, 'Pseudocódigo sem exceções de integração');
    output.textContent = `${results.length} verificações passaram.\n\n` + results.join('\n');
  } catch (error) {
    output.textContent = 'FALHOU · ' + error.message + '\n\n' + results.join('\n');
  } finally {
    trigger.disabled = false;
    // Remove apenas rascunhos pertencentes ao usuário inventado desta rodada.
    for (const mode of ['teacher', 'student']) localStorage.removeItem('ominisaber.programming.v1:' + mode + ':fixture-programming-' + nonce);
  }
}
trigger.addEventListener('click', run);
