// Teste de ponta a ponta contra a API no ar (com os dados de teste do SEED_DEMO), usando os mesmos eventos do app.
// Uso: node test/fluxo.mjs [http://localhost:3000/api/v1]
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { uuidv7 } from 'uuidv7';

const BASE = process.argv[2] ?? 'http://localhost:3000/api/v1';

async function chamar(caminho, { metodo = 'GET', corpo, token, headers = {}, bruto } = {}) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: bruto ?? (corpo ? JSON.stringify(corpo) : undefined),
  });
  const texto = await r.text();
  return { status: r.status, dados: texto ? JSON.parse(texto) : null, headers: r.headers };
}

const ok = (r, status = 200) => {
  assert.equal(r.status, status, JSON.stringify(r.dados));
  return r.dados;
};
const dispositivo = (id) => ({ identificadorInstalacao: id, plataforma: 'android', modelo: 'Teste', versaoSo: '14', versaoApp: '0.2.0' });
const agora = () => new Date().toISOString();
const passo = (t) => console.log(`✓ ${t}`);

// Login: vigilante no app, admin no app (instalação), coordenador no painel.
const vig = ok(await chamar('/auth/login', { metodo: 'POST', corpo: { matricula: 'vigilante', senha: '1234', dispositivo: dispositivo(randomUUID()) } }));
assert.ok(vig.refreshToken);
const adm = ok(await chamar('/auth/login', { metodo: 'POST', corpo: { matricula: 'admin', senha: '1234', dispositivo: dispositivo(randomUUID()) } }));
const coord = ok(await chamar('/auth/login', { metodo: 'POST', corpo: { matricula: 'coordenador', senha: '1234' }, headers: { 'X-Requested-With': 'guardiao-painel' } }));
assert.equal((await chamar('/auth/login', { metodo: 'POST', corpo: { matricula: 'vigilante', senha: 'errada', dispositivo: dispositivo(randomUUID()) } })).status, 401);
assert.equal((await chamar('/auth/login', { metodo: 'POST', corpo: { matricula: 'coordenador', senha: '1234', dispositivo: dispositivo(randomUUID()) } })).dados.codigo, 'PAPEL_SEM_ACESSO_AO_CANAL');
passo('login nos dois canais e recusas');

// Refresh com rotação e detecção de reuso.
const novo = ok(await chamar('/auth/refresh', { metodo: 'POST', corpo: { refreshToken: vig.refreshToken } }));
assert.equal((await chamar('/auth/refresh', { metodo: 'POST', corpo: { refreshToken: vig.refreshToken } })).status, 401);
assert.equal((await chamar('/auth/refresh', { metodo: 'POST', corpo: { refreshToken: novo.refreshToken } })).status, 401, 'reuso revoga a família');
const v = ok(await chamar('/auth/login', { metodo: 'POST', corpo: { matricula: 'vigilante', senha: '1234', dispositivo: dispositivo(randomUUID()) } }));
passo('refresh com rotação; reuso revoga a família');

// Pacote offline com ETag.
const pac = await chamar('/vigilante/pacote-offline', { token: v.accessToken });
const pacote = ok(pac);
assert.ok(pacote.pontos.length >= 6 && pacote.tiposOcorrencia.length >= 8);
assert.equal((await chamar('/vigilante/pacote-offline', { token: v.accessToken, headers: { 'If-None-Match': pac.headers.get('etag') } })).status, 304);
passo('pacote offline e 304 com ETag');

// Admin vincula uma tag (modo instalação) e o pacote muda.
const [p1, p2, p3] = pacote.pontos;
ok(await chamar('/tags-nfc', { metodo: 'POST', token: adm.accessToken, corpo: { pontoRondaId: p1.id, uidHex: '04A1B2C3', tipo: 'NTAG215_LEGADA', leituraSun: null } }), 201);
assert.equal((await chamar('/tags-nfc', { metodo: 'POST', token: v.accessToken, corpo: { pontoRondaId: p1.id, uidHex: '04A1B2C4', tipo: 'NTAG215_LEGADA' } })).status, 403);
assert.equal((await chamar('/vigilante/pacote-offline', { token: v.accessToken, headers: { 'If-None-Match': pac.headers.get('etag') } })).status, 200);
passo('vínculo de tag pelo admin (vigilante não pode)');

// Ronda disponível do seed.
const rondas = ok(await chamar(`/vigilante/rondas?de=${agora().slice(0, 10)}&ate=${agora().slice(0, 10)}`, { token: v.accessToken })).itens;
const ronda = rondas.find((r) => r.status === 'AGENDADA' && Date.parse(r.inicioPrevisto) <= Date.now());
assert.ok(ronda, 'ronda disponível agora');
passo(`rondas do vigilante (${rondas.length})`);

const ev = (tipo, dados, id = uuidv7()) => ({ id, tipo, criadoEmDispositivo: agora(), dados });
const loc = { latitude: -21.35, longitude: -46.52, precisaoM: 12 };
const ocorrenciaId = uuidv7();
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...randomUUID().split('').map((c) => c.charCodeAt(0)), 0xff, 0xd9]);
const sha = createHash('sha256').update(jpeg).digest('hex');
const fotoId = uuidv7();
const visitaId = uuidv7();
const lote = [
  ev('PONTO_VISITADO', { rondaId: ronda.id, pontoRondaId: p1.id, uidHex: '04A1B2C3', payloadNfc: 'UID:04A1B2C3', lidoEmDispositivo: agora(), localizacao: loc, localizacaoSimulada: false, resultadoGeoDispositivo: 'INDETERMINADO', foraDaOrdem: false }),
  ev('RONDA_INICIADA', { rondaId: ronda.id, iniciadaEmDispositivo: agora(), localizacao: loc }),
  ev('PONTO_VISITADO', { rondaId: ronda.id, pontoRondaId: p1.id, uidHex: '04A1B2C3', payloadNfc: 'UID:04A1B2C3', lidoEmDispositivo: agora(), localizacao: loc, localizacaoSimulada: false, resultadoGeoDispositivo: 'INDETERMINADO', foraDaOrdem: false }, visitaId),
  ev('PONTO_CONFERIDO', { rondaId: ronda.id, pontoRondaId: p1.id, visitaId, itens: [{ item: 'Portas trancadas', ok: true }, { item: 'Luzes apagadas', ok: false }], conferidoEmDispositivo: agora() }),
  ev('PONTO_VISITADO', { rondaId: ronda.id, pontoRondaId: p2.id, uidHex: '04A1B2C3', payloadNfc: 'UID:04A1B2C3', lidoEmDispositivo: agora(), localizacao: loc, localizacaoSimulada: false, resultadoGeoDispositivo: 'INDETERMINADO', foraDaOrdem: false }),
  ev('PONTO_VISITADO', { rondaId: ronda.id, pontoRondaId: p3.id, uidHex: '04FFFFFF', payloadNfc: 'UID:04FFFFFF', lidoEmDispositivo: agora(), localizacao: null, localizacaoSimulada: false, resultadoGeoDispositivo: 'SEM_LOCALIZACAO', foraDaOrdem: true }),
  ev('OCORRENCIA_REGISTRADA', {
    rondaId: ronda.id, tipoOcorrenciaId: pacote.tiposOcorrencia[2].id, gravidade: 'BAIXA', descricao: 'Luz da sala 12 acesa', predioId: p1.predioId, andarId: null, setorId: null,
    pontoRondaId: p1.id, detalheLocal: 'Sala 12', resolvidoNoLocal: false, registradaEmDispositivo: agora(), localizacao: loc, localizacaoSimulada: false,
    fotos: [{ fotoId, sha256: sha, tamanhoBytes: jpeg.length }],
  }, ocorrenciaId),
  ev('PONTO_JUSTIFICADO', { rondaId: ronda.id, pontoRondaId: pacote.pontos[3].id, motivo: 'ACESSO_BLOQUEADO', descricao: 'Porta trancada com cadeado', justificadaEmDispositivo: agora(), localizacao: null }),
  ev('RONDA_FINALIZADA', { rondaId: ronda.id, finalizadaEmDispositivo: agora(), localizacao: loc, finalizadaComPendencias: true, observacao: 'Tudo tranquilo' }),
];
const res = ok(await chamar('/sincronizacao/eventos', { metodo: 'POST', token: v.accessToken, corpo: { eventos: lote }, headers: { 'X-Enviado-Em-Dispositivo': agora() } })).resultados;
const r = (i) => res[i].resultado + (res[i].codigo ? `:${res[i].codigo}` : '');
assert.deepEqual(res.map((_, i) => r(i)), [
  'REJEITADO:RONDA_NAO_INICIADA', 'ACEITO', 'ACEITO', 'ACEITO', 'REJEITADO:TAG_NAO_PERTENCE_AO_PONTO', 'ACEITO', 'ACEITO', 'ACEITO', 'ACEITO',
]);
const again = ok(await chamar('/sincronizacao/eventos', { metodo: 'POST', token: v.accessToken, corpo: { eventos: lote.slice(1, 3) } })).resultados;
assert.deepEqual(again.map((x) => x.resultado), ['DUPLICADO', 'DUPLICADO']);
passo('lote de eventos: regras, recusas e idempotência');

// Foto: hash divergente, sucesso, repetição idempotente.
const put = (h) => chamar(`/ocorrencias/${ocorrenciaId}/fotos/${fotoId}`, { metodo: 'PUT', token: v.accessToken, bruto: jpeg, headers: { 'Content-Type': 'image/jpeg', 'Content-SHA256': h } });
assert.equal((await put('0'.repeat(64))).dados.codigo, 'FOTO_HASH_DIVERGENTE');
ok(await put(sha), 201);
ok(await put(sha), 200);
passo('upload de foto idempotente com conferência de hash');

// Painel: resumo, detalhe da ronda, revisão de visita sinalizada, ocorrência e foto.
const resumo = ok(await chamar('/painel/resumo', { token: coord.accessToken }));
assert.ok(resumo.rondas.incompletas >= 1 && resumo.alertas.visitasPendentesRevisao >= 1);
const det = ok(await chamar(`/rondas/${ronda.id}`, { token: coord.accessToken }));
assert.equal(det.status, 'INCOMPLETA');
assert.deepEqual(det.pontos.slice(0, 4).map((p) => p.situacao), ['VISITADO', 'PENDENTE', 'VISITA_SINALIZADA', 'JUSTIFICADO']);
assert.ok(det.linhaDoTempo.find((x) => x.tipo === 'VISITA' && x.checklist));
const sinalizada = ok(await chamar('/visitas', { token: coord.accessToken })).itens.find((x) => x.rondaId === ronda.id);
assert.equal((await chamar(`/visitas/${sinalizada.id}/revisao`, { metodo: 'POST', token: coord.accessToken, corpo: { decisao: 'REJEITADA' } })).status, 422);
ok(await chamar(`/visitas/${sinalizada.id}/revisao`, { metodo: 'POST', token: coord.accessToken, corpo: { decisao: 'REJEITADA', observacao: 'Tag não é a do ponto, conferido no local.' } }), 204);
const oc = ok(await chamar(`/ocorrencias/${ocorrenciaId}`, { token: coord.accessToken }));
assert.equal(oc.fotos.length, 1);
const foto = await fetch(`${BASE}/ocorrencias/${ocorrenciaId}/fotos/${fotoId}`, { headers: { Authorization: `Bearer ${coord.accessToken}` } });
assert.equal(createHash('sha256').update(Buffer.from(await foto.arrayBuffer())).digest('hex'), sha);
assert.equal((await chamar(`/ocorrencias/${ocorrenciaId}/status`, { metodo: 'POST', token: coord.accessToken, corpo: { statusNovo: 'RESOLVIDA' } })).dados.codigo, 'COMENTARIO_OBRIGATORIO');
ok(await chamar(`/ocorrencias/${ocorrenciaId}/status`, { metodo: 'POST', token: coord.accessToken, corpo: { statusNovo: 'EM_ATENDIMENTO', comentario: 'Manutenção avisada' } }), 204);
assert.equal((await chamar('/painel/resumo', { token: v.accessToken })).status, 403);
passo('painel: resumo, linha do tempo, revisão, ocorrência e foto; vigilante sem acesso');

// Planejamento: roteiro, agenda e ronda avulsa geram rondas para o vigilante.
const vigId = ok(await chamar('/usuarios?papel=VIGILANTE', { token: coord.accessToken }))[0].id;
const rot = ok(await chamar('/roteiros', { metodo: 'POST', token: coord.accessToken, corpo: { nome: `Teste ${Date.now()}`, exigeOrdem: true, pontos: [{ pontoRondaId: p1.id }, { pontoRondaId: p2.id }] } }), 201);
ok(await chamar('/agendas', { metodo: 'POST', token: coord.accessToken, corpo: { roteiroId: rot.id, vigilanteId: vigId, diasSemana: [0, 1, 2, 3, 4, 5, 6], horaInicio: '23:30', duracaoMin: 30 } }), 201);
ok(await chamar('/rondas', { metodo: 'POST', token: coord.accessToken, corpo: { roteiroId: rot.id, vigilanteId: vigId, inicioPrevisto: new Date(Date.now() + 3600e3).toISOString(), duracaoMin: 45 } }), 201);
const depois = ok(await chamar(`/vigilante/rondas?de=${agora().slice(0, 10)}&ate=${agora().slice(0, 10)}`, { token: v.accessToken })).itens;
assert.ok(depois.filter((x) => x.roteiro.id === rot.id).length >= 2);
passo('roteiro, agenda e ronda avulsa');

console.log('\nTudo certo.');
