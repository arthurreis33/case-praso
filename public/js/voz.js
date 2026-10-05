// Nota por voz (seção 6.7). A nota é DO VENDEDOR, ao sair do ponto. Não é gravação da conversa com o dono.
//  · MediaRecorder, no máximo 60 s; o áudio vai para o IndexedDB na hora (nada espera a rede);
//  · a transcrição entra numa FILA e roda quando houver sinal, pela função serverless /api/transcrever;
//  · o LLM extrai núcleo, motivo, próxima ação e pesquisa; o vendedor confirma com um toque, e o que a IA
//    preencheu fica marcado;
//  · o áudio é apagado depois de transcrito;
//  · MODO DEMONSTRAÇÃO: sem chave no servidor (ou sem a função), a transcrição é simulada a partir de
//    textos de exemplo e a extração roda por regras no próprio aparelho (extrair.js).
// O ditado do teclado continua valendo no campo de texto.
import { esc, toast, quando } from './ui.js';
import { CONFIG } from './config.js';
import { extrairCampos, NOTAS_EXEMPLO } from './extrair.js';
import * as C from './catalogo.js';

export function pendentesFila(store) {
  return store.estado.visitas.filter((v) => v.transcricao_status === 'pendente').length;
}

let rodando = false;
let avisar = () => {};

export function iniciarFila(store, { aoMudar = () => {} } = {}) {
  avisar = aoMudar;
  window.addEventListener('online', () => processarFila(store));
  setInterval(() => processarFila(store), 30000);
  setTimeout(() => processarFila(store), 2000);
}

const paraBase64 = (blob) => new Promise((ok, erro) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = () => erro(r.error);
  r.readAsDataURL(blob);
});

/** Texto de exemplo coerente com o que já foi registrado na visita (modo demonstração). */
function notaExemplo(store, v) {
  if (store.cadastroNaVisita(v)) return NOTAS_EXEMPLO.cadastro;
  return NOTAS_EXEMPLO[v.nucleo?.resultado] || NOTAS_EXEMPLO.falou_com_decisor;
}

/** Só sugere o que ainda está vazio: a IA não sobrescreve o que o vendedor marcou. */
function soVazios(v, campos) {
  const r = {};
  const get = (path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), v);
  for (const [k, val] of Object.entries(campos || {})) {
    const atual = k === 'proxima_acao' ? v.proxima_acao : get(k);
    const vazio = atual == null || atual === '' || (Array.isArray(atual) && !atual.length) || (k === 'proxima_acao' && !atual?.confirmada_em);
    if (vazio) r[k] = val;
  }
  return r;
}

export async function processarFila(store) {
  if (rodando) return;
  const fila = store.estado.visitas.filter((v) => v.transcricao_status === 'pendente');
  if (!fila.length || !navigator.onLine) { avisar(); return; }
  rodando = true;
  try {
    for (const v of fila) {
      const blob = await store.lerAudio(v.id).catch(() => null);
      let resp = null;
      try {
        if (!blob) throw Object.assign(new Error('áudio não encontrado'), { demo: true });
        const r = await fetch('api/transcrever', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            audio_base64: await paraBase64(blob), mime: blob.type || v.audio?.mime,
            contexto: { tipo_visita: v.tipo, resultado: v.nucleo.resultado, hoje: store.agora().toISOString() },
          }),
        });
        if (r.status === 501 || r.status === 404 || r.status === 405) throw Object.assign(new Error('sem chave'), { demo: true });
        if (!r.ok) throw new Error(`servidor ${r.status}`);
        resp = await r.json();
      } catch (e) {
        if (!e.demo && navigator.onLine && (v.transcricao_tentativas || 0) >= 2) {
          store.registrarTranscricao(v.id, { status: 'falhou', erro: e.message });
          continue;
        }
        if (!e.demo) { store.registrarTranscricao(v.id, { status: 'pendente', erro: e.message }); continue; }
        // modo demonstração: texto de exemplo + extração por regras no aparelho
        await new Promise((ok) => setTimeout(ok, 900));
        const texto = notaExemplo(store, v);
        resp = { modo: 'demo', texto, campos: extrairCampos(texto, { agora: store.agora() }) };
      }
      const campos = soVazios(v, { ...extrairCampos(resp.texto, { agora: store.agora() }), ...(resp.campos || {}) });
      store.registrarTranscricao(v.id, { status: 'ok', texto: resp.texto, campos, modo: resp.modo });
      await store.apagarAudio(v.id).catch(() => {});
      toast(resp.modo === 'demo' ? 'Nota transcrita (modo demonstração): confira o que a IA sugeriu' : 'Nota transcrita: confira o que a IA sugeriu', 3500);
      document.dispatchEvent(new CustomEvent('transcricao', { detail: { visitaId: v.id } }));
    }
  } finally {
    rodando = false;
    avisar();
  }
}

function escolherMime() {
  const opcoes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return opcoes.find((m) => globalThis.MediaRecorder?.isTypeSupported?.(m)) || '';
}

const DESCR = {
  'nucleo.resultado': ['Resultado', C.RESULTADOS], 'nucleo.quem_decide': ['Quem decide', C.QUEM_DECIDE], 'nucleo.faixas': ['Janela', C.FAIXAS],
  motivo_nao_avanco: ['Motivo', C.MOTIVOS_NAO_AVANCO], 'pesquisa.ultima_compra.canal': ['Canal', C.CANAIS],
  'pesquisa.fornecedores.quantos': ['Fornecedores', C.N_FORNECEDORES], 'pesquisa.fornecedores.dor_de_cabeca': ['Reclama de', null],
  'pesquisa.pagamento.forma': ['Pagamento', C.FORMAS_PAGAMENTO], 'pesquisa.pagamento.prazo': ['Prazo', C.PRAZOS],
  'pesquisa.apps.estimulado.conhece': ['Conhece', C.APPS], 'pesquisa.troca.o_que_faria_trocar': ['Trocaria por', C.GATILHOS_TROCA],
  'pesquisa.papeis.quem_paga': ['Quem paga', C.QUEM_PAGA],
};
function descrever(k, val, agora) {
  if (k === 'proxima_acao') return ['Próxima ação', `${C.rotulo(C.PROXIMAS_ACOES, val.tipo)}${val.data_hora ? ` ${quando(val.data_hora, agora)}` : ''}`];
  const [r, lista] = DESCR[k] || [k, null];
  const f = (x) => (lista ? C.rotulo(lista, x) : x);
  return [r, Array.isArray(val) ? val.map(f).join(', ') : f(val)];
}

/** Monta o gravador na tela da visita. Devolve a função de desmontagem. */
export function montarGravador(el, store, v, { aoMudar = () => {} } = {}) {
  if (!el) return null;
  let rec = null;
  let pedacos = [];
  let inicio = 0;
  let timer = null;
  let stream = null;
  const suporta = !!(navigator.mediaDevices?.getUserMedia && globalThis.MediaRecorder);

  function desenhar() {
    const vv = store.visita(v.id);
    const st = vv.transcricao_status;
    const gravando = rec?.state === 'recording';
    const seg = gravando ? Math.floor((Date.now() - inicio) / 1000) : 0;
    const sug = vv.ia_sugestao?.campos;
    el.innerHTML = `
      ${suporta ? `<button type="button" class="gravar ${gravando ? 'ativo' : ''}" data-voz="${gravando ? 'parar' : 'gravar'}" aria-label="${gravando ? 'Parar gravação' : 'Gravar nota de voz, até 60 segundos'}">
        <span class="bola" aria-hidden="true"></span>${gravando ? `Parar · ${seg}s de ${CONFIG.max_audio_s}s` : 'Gravar nota (até 60 s)'}</button>`
        : '<p class="dica">Este navegador não grava áudio. Use o microfone do teclado no campo abaixo.</p>'}
      ${st === 'pendente' ? `<p class="gps" role="status">Na fila de transcrição${navigator.onLine ? ': transcrevendo…' : ': transcreve quando houver sinal'} (${vv.audio?.dur_s || '?'} s gravados, salvos no aparelho)</p>` : ''}
      ${st === 'falhou' ? `<p class="gps erro">A transcrição falhou (${esc(vv.transcricao_erro || '')}). <button type="button" class="link-btn" data-voz="tentar">Tentar de novo</button></p>` : ''}
      ${st === 'ok' && !sug ? `<p class="gps ok">Transcrito${vv.transcricao_modo === 'demo' ? ' (modo demonstração: texto de exemplo)' : ''}. Áudio apagado.</p>` : ''}
      ${sug ? `<div class="caixa destaque" role="region" aria-label="Sugestões da IA">
        <b>A IA leu a nota e sugere</b>${vv.transcricao_modo === 'demo' ? ' <span class="selo-simulado">demonstração</span>' : ''}
        <dl class="dl">${Object.entries(sug).map(([k, val]) => { const [r, d] = descrever(k, val, store.agora()); return `<dt>${esc(r)}</dt><dd>${esc(d)}</dd>`; }).join('')}</dl>
        <div class="linha-btns" style="margin-top:8px"><button type="button" class="btn primaria" data-voz="confirmar">Confirmar tudo</button><button type="button" class="btn" data-voz="descartar">Descartar</button></div>
        <p class="dica">O que você confirmar fica marcado com <span class="marca-ia">IA</span>. Tocar num campo depois tira a marca.</p></div>` : ''}`;
  }

  async function gravar() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      toast(`Microfone: ${e.name === 'NotAllowedError' ? 'permissão negada' : e.message}. Use o ditado do teclado.`, 4000);
      return;
    }
    const mime = escolherMime();
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    pedacos = [];
    rec.ondataavailable = (e) => { if (e.data.size) pedacos.push(e.data); };
    rec.onstop = async () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      const dur = Math.round((Date.now() - inicio) / 1000);
      const blob = new Blob(pedacos, { type: rec.mimeType || mime || 'audio/webm' });
      try {
        await store.salvarAudio(v.id, blob);
        store.registrarAudio(v.id, { mime: blob.type, dur_s: dur });
        toast(navigator.onLine ? 'Nota salva · transcrevendo' : 'Nota salva no aparelho · transcreve quando houver sinal');
      } catch (e) { toast(`Não salvei o áudio: ${e.message}`); }
      rec = null;
      desenhar(); aoMudar();
      processarFila(store);
    };
    inicio = Date.now();
    rec.start(1000);
    timer = setInterval(() => {
      if (Date.now() - inicio >= CONFIG.max_audio_s * 1000) rec?.stop();
      desenhar();
    }, 1000);
    desenhar();
  }

  const onClick = (ev) => {
    const a = ev.target.closest('[data-voz]')?.dataset.voz;
    if (!a) return;
    if (a === 'gravar') gravar();
    if (a === 'parar') rec?.stop();
    if (a === 'tentar') { store.registrarTranscricao(v.id, { status: 'pendente' }); processarFila(store); desenhar(); }
    if (a === 'confirmar') { const n = store.aplicarIA(v.id)?.length || 0; toast(`${n} campo${n === 1 ? '' : 's'} preenchido${n === 1 ? '' : 's'} pela IA`); aoMudar(); desenhar(); }
    if (a === 'descartar') { store.descartarIA(v.id); desenhar(); }
  };
  el.addEventListener('click', onClick);
  const onTrans = (e) => { if (e.detail.visitaId === v.id) { desenhar(); aoMudar(); } };
  document.addEventListener('transcricao', onTrans);
  desenhar();
  return () => {
    document.removeEventListener('transcricao', onTrans);
    clearInterval(timer);
    if (rec?.state === 'recording') rec.stop();
    stream?.getTracks().forEach((t) => t.stop());
  };
}
