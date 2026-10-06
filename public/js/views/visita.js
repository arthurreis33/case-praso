// Registro de visita (seção 6.7).
//  Check-in (GPS, precisão, hora; pergunta "corrigir o pino?" a mais de 150 m)
//  → núcleo em 3 toques, sempre em chips (RF06 da V1): resultado · quem decide · janela do decisor
//  → motivo de não avanço (só quando não é avanço) → próxima ação sugerida, confirmada com um toque
//  → nota do vendedor ao sair (voz ou texto) → pesquisa opcional recolhida (RF07) e surpresa (RF08)
//  → check-out com os tempos do RF11.
// Tudo é gravado no toque; nenhum botão espera rede.
import * as C from '../catalogo.js';
import { esc, chips, alternarChip, quando, hora, duracao, toast, dinheiro, confirmar } from '../ui.js';
import { obterPosicao } from '../geo.js';
import { duracoes } from '../rules.js';
import { nomeDe } from '../store.js';
import { CONFIG } from '../config.js';
import { sugerirProximaAcao, pedeMotivo } from '../proxima.js';
import { cesta } from '../whatsapp.js';
import { resumoCompras } from '../historico.js';
import { montarGravador } from '../voz.js';
import { modoDemo } from '../demo.js';

const pedindoGps = new Set();
const R = C.rotulo;
const rotuloCampo = (t, ia = false) => `<p class="passo">${t}${ia ? '<span class="marca-ia">IA</span>' : ''}</p>`;
const texto = (campo, valor, ph = '') => `<textarea data-campo="${campo}" rows="2" placeholder="${esc(ph)}">${esc(valor || '')}</textarea>`;

function htmlPesquisa(v) {
  const q = v.pesquisa || {};
  const g = (path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), q);
  const ia = (c) => v.campos_ia?.includes(`pesquisa.${c}`);
  return `
    <p class="dica">Opcional. Nada aqui segura a visita.</p>
    ${rotuloCampo('Quem paga os fornecedores', ia('papeis.quem_paga'))}${chips('pesquisa.papeis.quem_paga', C.QUEM_PAGA, g('papeis.quem_paga'))}
    ${rotuloCampo('Canal de compra hoje', ia('ultima_compra.canal'))}${chips('pesquisa.ultima_compra.canal', C.CANAIS, g('ultima_compra.canal'))}
    ${rotuloCampo('Quantos fornecedores', ia('fornecedores.quantos'))}${chips('pesquisa.fornecedores.quantos', C.N_FORNECEDORES, g('fornecedores.quantos'), { classe: 'compacto' })}
    ${rotuloCampo('De qual mais reclama, e por quê', ia('fornecedores.dor_de_cabeca'))}${texto('pesquisa.fornecedores.dor_de_cabeca', g('fornecedores.dor_de_cabeca'))}
    ${rotuloCampo('Forma de pagamento', ia('pagamento.forma'))}${chips('pesquisa.pagamento.forma', C.FORMAS_PAGAMENTO, g('pagamento.forma'))}
    ${rotuloCampo('Prazo', ia('pagamento.prazo'))}${chips('pesquisa.pagamento.prazo', C.PRAZOS, g('pagamento.prazo'))}
    ${rotuloCampo('Conhece', ia('apps.estimulado.conhece'))}${chips('pesquisa.apps.estimulado.conhece', C.APPS, g('apps.estimulado.conhece'), { multi: true, exclusivo: 'nenhum' })}
    ${rotuloCampo('O que o faria trocar de fornecedor', ia('troca.o_que_faria_trocar'))}${chips('pesquisa.troca.o_que_faria_trocar', C.GATILHOS_TROCA, g('troca.o_que_faria_trocar'), { multi: true, exclusivo: 'nada' })}
    <details class="dobra"><summary>Mais do roteiro de campo (V1)</summary>
      ${rotuloCampo('Antes de entrar')}${chips('observacao', C.OBSERVACOES, v.observacao, { multi: true })}
      ${rotuloCampo('Versão da conversa')}${chips('versao_conversa', C.VERSOES, v.versao_conversa)}
    </details>`;
}

function modeloVisita(store, v, p) {
  const sit = store.situacao(p.id);
  if (v.tipo === 'aquisicao') {
    const c = cesta(p.tipo);
    return `<div class="destaque-modelo"><b>Aquisição · objetivo: cadastro no app, agora.</b>
      <div class="sutil">Cadastro no celular do dono; no fim, ele marca "Vendedor da Praso" em "Como você conheceu?". Cesta de entrada: ${esc(c.titulo)} (${esc(c.itens.slice(0, 3).map((i) => i.nome.split(' ')[0]).join(', '))}…). Os 7 dias para pagar dependem da análise de crédito: não prometa.</div></div>`;
  }
  if (v.tipo === 'acompanhamento') {
    const ult = store.pedidosDo(p.id)[0];
    return `<div class="destaque-modelo"><b>Acompanhamento · objetivo: recompra.</b>
      <div class="sutil">${sit.estado === 'ativacao' ? `${sit.compras_ciclo}/3 compras · ${esc(sit.prazo.texto)}. ` : ''}${ult ? `Último pedido ${esc(quando(ult.data, store.agora()))}, ${dinheiro(ult.valor)}.` : ''} A 3ª compra precisa ser autônoma: mostre o "repetir pedido".</div></div>`;
  }
  const r = resumoCompras(store.pedidosDo(p.id));
  return `<div class="destaque-modelo"><b>Reconquista · objetivo: entender a saída.</b>
    <div class="sutil">${r ? `Comprava ${esc(r.top_categorias[0]?.rotulo || '')} (${dinheiro(r.ticket_medio)} por pedido). ${r.parou_de_comprar.length ? `Parou de comprar ${esc(r.parou_de_comprar.map((x) => x.rotulo.toLowerCase()).join(', '))} antes de sair. ` : ''}${esc(sit.prazo?.texto || '')}.` : 'Sem histórico de compras.'}</div></div>`;
}

export function renderVisita({ main, barra, store, ir, render }, id) {
  const v = store.visita(id);
  if (!v) return ir('#/hoje');
  const p = store.ponto(v.ponto_id) || { nome_fantasia: '(ponto removido)' };
  const ia = (c) => v.campos_ia?.includes(c);
  let pinoRespondido = false;

  main.innerHTML = `
    <div class="cabecalho-visita">
      <div class="sutil"><span class="selo">${esc(R(C.TIPOS_VISITA, v.tipo))}</span>${v.planejada_para ? ` previsto ${esc(hora(v.planejada_para))}` : ''}</div>
      <h1>${v.ponto_id && store.ponto(v.ponto_id) ? `<a class="titulo-link" href="#/ponto/${esc(p.id)}">${esc(nomeDe(p))}</a>` : esc(nomeDe(p))}</h1>
      <div id="relogio" class="sutil"></div>
      <div id="gps" class="gps"></div>
      <div id="pino"></div>
      ${v.retorno_previsto ? `<p class="retorno-previsto">Revisita · sugerido ${esc(quando(v.retorno_previsto.quando, store.agora()))}</p>` : ''}
    </div>
    ${modeloVisita(store, v, p)}
    <div id="cadastro-detectado"></div>

    <section class="nucleo" aria-label="Registro em 3 toques">
      <h2>Registro · 3 toques</h2>
      ${rotuloCampo('1 · Resultado', ia('nucleo.resultado'))}${chips('nucleo.resultado', C.RESULTADOS, v.nucleo.resultado)}
      ${rotuloCampo('2 · Quem decide a compra', ia('nucleo.quem_decide'))}${chips('nucleo.quem_decide', C.QUEM_DECIDE, v.nucleo.quem_decide)}
      ${rotuloCampo('3 · Quando o decisor está', ia('nucleo.faixas'))}
      ${chips('nucleo.faixas', C.FAIXAS, v.nucleo.faixas, { multi: true })}
      ${chips('nucleo.dias', C.DIAS, v.nucleo.dias, { multi: true, classe: 'compacto' })}
      <p class="dica">Sem dia marcado = qualquer dia.${v.nucleo.prefill ? ' Decisor e janela vieram do ponto: só toque se mudou.' : ''}</p>
      <div id="motivo"></div>
      <div id="resumo-nucleo" class="resumo-nucleo"></div>
    </section>

    <section class="proxima" id="proxima" aria-label="Próxima ação"></section>

    <section class="surpresa">
      <h2>Nota do vendedor, ao sair do ponto</h2>
      <p class="dica">Sua nota, depois de sair. Não grave o cliente.</p>
      <div id="voz"></div>
      ${texto('nota_texto', v.nota_texto, 'Ou digite / dite pelo microfone do teclado')}
    </section>

    <details class="bloco" id="bloco-pesquisa"${v.pesquisa.inicio ? ' open' : ''}>
      <summary>Pesquisa (opcional)</summary>
      ${htmlPesquisa(v)}
    </details>

    <section class="surpresa">
      <h2>O que me surpreendeu aqui</h2>
      ${texto('surpresa', v.surpresa)}
      ${rotuloCampo('A nota foi por')}${chips('nota_origem', C.MODOS_REGISTRO, v.nota_origem)}
    </section>`;

  const elRel = main.querySelector('#relogio');
  const elGps = main.querySelector('#gps');
  const elPino = main.querySelector('#pino');
  const elRes = main.querySelector('#resumo-nucleo');
  const elMot = main.querySelector('#motivo');
  const elProx = main.querySelector('#proxima');
  const elCad = main.querySelector('#cadastro-detectado');

  function atualizarRelogio() {
    const ent = `Check-in ${hora(v.checkin.em)}`;
    if (v.checkout) elRel.textContent = `${ent} · check-out ${hora(v.checkout.em)} · ${duracao(duracoes(v).tempo_no_ponto_s)} no ponto`;
    else elRel.textContent = `${ent} · ${Math.floor((store.agora() - new Date(v.checkin.em)) / 60000)} min no ponto`;
  }

  function atualizarGps() {
    const c = v.checkin;
    if (c.lat != null) {
      const ruim = c.precisao_m > 50;
      elGps.className = `gps ${ruim ? 'ruim' : 'ok'}`;
      elGps.innerHTML = `GPS ±${c.precisao_m} m${ruim ? ' · precisão baixa <button type="button" class="btn peq" data-acao="gps">Tentar de novo</button>' : ''}`;
    } else if (pedindoGps.has(v.id)) {
      elGps.className = 'gps'; elGps.textContent = 'Buscando GPS… (pode seguir registrando)';
    } else {
      elGps.className = 'gps erro';
      elGps.innerHTML = `GPS: ${esc(c.gps_erro || 'sem posição')} <button type="button" class="btn peq" data-acao="gps">Tentar de novo</button>`;
    }
    atualizarPino();
  }

  function atualizarPino() {
    const d = v.checkin.distancia_pino_m;
    const conf = store.ponto(p.id)?.coord_confirmada;
    const jaCorrigido = conf?.origem === 'checkin' && conf.em >= v.checkin.em;
    if (d != null && d > CONFIG.limiar_corrigir_pino_m && !jaCorrigido && !pinoRespondido && !v.checkout) {
      elPino.innerHTML = `<div class="pergunta-pino" role="alert">Você está a <b>${d >= 1000 ? `${(d / 1000).toFixed(1).replace('.', ',')} km` : `${d} m`}</b> do pino deste ponto. Corrigir o pino para cá?
        <div class="linha-btns"><button class="btn primaria" data-acao="pino-sim">Corrigir para cá</button><button class="btn" data-acao="pino-nao">Não, o pino está certo</button></div></div>`;
    } else if (jaCorrigido && d > CONFIG.limiar_corrigir_pino_m) {
      elPino.innerHTML = '<p class="gps ok">Pino corrigido para a posição do check-in.</p>';
    } else elPino.innerHTML = '';
  }

  function pedirGps() {
    if (pedindoGps.has(v.id)) return;
    pedindoGps.add(v.id);
    atualizarGps();
    obterPosicao({ maximumAge: 0 })
      .then((pos) => store.registrarGeo(v.id, pos))
      .catch((e) => store.registrarGeo(v.id, null, e.message))
      .finally(() => { pedindoGps.delete(v.id); if (document.body.contains(elGps)) atualizarGps(); });
  }

  function atualizarMotivo() {
    const cad = store.cadastroNaVisita(v);
    elCad.innerHTML = cad
      ? '<div class="caixa destaque" role="status"><b>Cadastro feito no app durante a visita.</b> O ponto já está como Cadastrado.</div>'
      : (v.tipo === 'aquisicao' && !v.checkout && modoDemo() ? `<a class="btn mais-link demo-link" href="#/sim?p=${esc(p.id)}">Demonstração: simular "cadastro feito"</a>` : '');
    if (pedeMotivo(v.nucleo.resultado, cad)) {
      elMot.innerHTML = `${rotuloCampo(v.nucleo.resultado === 'recusou' ? 'Por que recusou?' : 'Por que não cadastrou hoje?', ia('motivo_nao_avanco'))}${chips('motivo_nao_avanco', C.MOTIVOS_NAO_AVANCO, v.motivo_nao_avanco)}`;
    } else elMot.innerHTML = '';
  }

  let trocando = false;
  function atualizarProxima() {
    const sug = sugerirProximaAcao(v, p, { agora: store.agora(), cadastroNaVisita: store.cadastroNaVisita(v), sit: store.situacao(p.id) });
    const pa = v.proxima_acao;
    if (!sug && !pa) { elProx.innerHTML = '<h2>Próxima ação</h2><p class="sutil">Aparece quando você marcar o resultado.</p>'; return; }
    const atual = pa?.confirmada_em ? pa : null;
    const desc = (x) => `${R(C.PROXIMAS_ACOES, x.tipo)}${x.data_hora ? ` · ${quando(x.data_hora, store.agora())}` : ''}`;
    const diverge = atual && sug && (atual.tipo !== sug.tipo || atual.data_hora !== sug.data_hora) && atual.sugerida;
    elProx.innerHTML = `<h2>Próxima ação${ia('proxima_acao') ? '<span class="marca-ia">IA</span>' : ''}</h2>
      ${atual ? `<p><b>${esc(desc(atual))}</b> <span class="selo">confirmada</span></p>${atual.porque ? `<p class="dica">${esc(atual.porque)}</p>` : ''}` : ''}
      ${!atual || diverge ? `<p>${atual ? 'Nova sugestão: ' : 'Sugestão: '}<b>${esc(desc(sug))}</b></p><p class="dica">Por quê: ${esc(sug.porque)}</p>
        <div class="linha-btns"><button class="btn primaria" data-acao="confirmar-proxima">Confirmar</button><button class="btn" data-acao="trocar-proxima">Trocar</button></div>`
        : '<button class="link-btn" data-acao="trocar-proxima">Trocar</button>'}
      ${trocando ? `<div style="margin-top:8px">${chips('troca-tipo', C.PROXIMAS_ACOES, atual?.tipo || sug?.tipo)}
        <div class="campo">Quando</div>${chips('troca-quando', [['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['janela', 'Na janela do decisor'], ['7d', 'Em 7 dias'], ['sem', 'Sem data']], null)}
        <button class="btn primaria" data-acao="salvar-troca" style="width:100%;margin-top:8px">Salvar próxima ação</button></div>` : ''}`;
    elProx._sug = sug;
  }

  function atualizarResumo() {
    const n = v.nucleo;
    const d = duracoes(v);
    elRes.className = 'resumo-nucleo';
    if (n.fim) {
      const pt = store.ponto(v.ponto_id);
      const destino = pt?.status_dia === 'retornar' && pt.retorno_sugerido ? `volta ${quando(pt.retorno_sugerido, store.agora())}` : 'ponto marcado como visitado';
      elRes.classList.add('ok');
      elRes.textContent = `Registro salvo em ${duracao(d.tempo_nucleo_s)}${d.nucleo_no_ponto === false ? ' (depois de sair)' : ''} · ${destino}`;
    } else if (n.inicio) {
      elRes.textContent = `Registrando desde ${hora(n.inicio)}. ${n.resultado ? 'Toque em Salvar registro.' : 'Falta o resultado.'}`;
    } else {
      elRes.textContent = 'Falta o resultado.';
    }
  }

  function atualizarBarra() {
    const n = v.nucleo;
    const btSalvar = `<button class="btn primaria grande" data-acao="salvar-nucleo"${n.resultado ? '' : ' disabled'}>Salvar registro</button>`;
    if (!v.checkout) {
      barra.innerHTML = n.fim ? '<button class="btn primaria grande" data-acao="checkout">Check-out</button>' : `${btSalvar}<button class="btn grande" data-acao="checkout">Check-out</button>`;
    } else {
      barra.innerHTML = n.fim ? '<button class="btn primaria grande" data-acao="concluir">Concluir</button>' : `${btSalvar}<button class="btn grande" data-acao="concluir">Concluir</button>`;
    }
  }

  function tudo() { atualizarRelogio(); atualizarGps(); atualizarMotivo(); atualizarProxima(); atualizarResumo(); atualizarBarra(); }

  const dataTroca = (q) => {
    const a = store.agora();
    if (q === 'hoje') return new Date(a.getTime() + 2 * 3600000).toISOString();
    if (q === 'amanha') return new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1, 10).toISOString();
    if (q === '7d') return new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7, 10).toISOString();
    if (q === 'janela') return elProx._sug?.data_hora || null;
    return null;
  };

  main.addEventListener('click', async (ev) => {
    const b = ev.target.closest('.chip');
    if (b) {
      const g = b.closest('.chips');
      const val = alternarChip(b);
      const campo = g.dataset.campo;
      if (campo.startsWith('troca-')) return;
      store.setCampo(v.id, campo, val ?? (g.dataset.multi === '1' ? [] : null));
      if (campo === 'nucleo.resultado') { atualizarMotivo(); }
      if (campo.startsWith('nucleo.') || campo === 'motivo_nao_avanco') atualizarProxima();
      atualizarResumo(); atualizarBarra();
      return;
    }
    const a = ev.target.closest('[data-acao]')?.dataset.acao;
    if (a === 'gps') pedirGps();
    if (a === 'pino-sim') {
      store.corrigirPino(p.id, { lat: v.checkin.lat, lng: v.checkin.lng, precisao_m: v.checkin.precisao_m }, 'checkin');
      pinoRespondido = true; toast('Pino corrigido: a posição do check-in vale daqui para frente'); atualizarPino();
    }
    if (a === 'pino-nao') { pinoRespondido = true; atualizarPino(); }
    if (a === 'confirmar-proxima') {
      const s = elProx._sug;
      if (s) { store.confirmarProximaAcao(v.id, { ...s, sugerida: true }); trocando = false; toast(s.tipo === 'retorno' ? `Retorno ${quando(s.data_hora, store.agora())}: já está na lista do dia certo` : 'Próxima ação confirmada'); }
      atualizarProxima(); atualizarResumo();
    }
    if (a === 'trocar-proxima') { trocando = !trocando; atualizarProxima(); }
    if (a === 'salvar-troca') {
      const tipo = elProx.querySelector('.chips[data-campo="troca-tipo"] [aria-pressed="true"]')?.dataset.v;
      const q = elProx.querySelector('.chips[data-campo="troca-quando"] [aria-pressed="true"]')?.dataset.v;
      if (!tipo) return toast('Escolha a ação');
      store.confirmarProximaAcao(v.id, { tipo, data_hora: tipo === 'nenhuma' ? null : dataTroca(q), porque: 'escolhida pelo vendedor', sugerida: false });
      trocando = false; atualizarProxima(); atualizarResumo(); toast('Próxima ação salva');
    }
  });
  main.addEventListener('input', (ev) => {
    const t = ev.target.closest('[data-campo]');
    if (t && t.tagName === 'TEXTAREA') {
      store.setCampo(v.id, t.dataset.campo, t.value);
      if (t.dataset.campo === 'nota_texto' && t.value && !v.nota_origem) store.setCampo(v.id, 'nota_origem', 'digitacao');
    }
  });

  barra.onclick = async (ev) => {
    const acao = ev.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'salvar-nucleo') {
      store.salvarNucleo(v.id);
      autoConfirmar();
      const pt = store.ponto(v.ponto_id);
      toast(pt?.status_dia === 'retornar' ? `Volta ${quando(pt.retorno_sugerido, store.agora())}` : 'Registro salvo');
      tudo();
    } else if (acao === 'checkout') {
      if (!v.nucleo.resultado && !(await confirmar('Check-out sem resultado?', 'O resultado é o único campo que alimenta a lista de amanhã. Sair mesmo assim?', 'Sair sem resultado'))) return;
      if (v.nucleo.resultado && !v.nucleo.fim) store.salvarNucleo(v.id);
      autoConfirmar();
      store.checkout(v.id);
      toast(v.nucleo.fim ? 'Check-out feito. Grave a nota ao sair.' : 'Check-out feito.');
      tudo();
      main.querySelector('.surpresa')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (acao === 'concluir') {
      ir(`#/ponto/${p.id}`);
    }
  };

  // Sem próxima ação confirmada ao salvar, a sugestão vale (o vendedor pode trocar depois).
  function autoConfirmar() {
    if (v.proxima_acao?.confirmada_em) return;
    const s = sugerirProximaAcao(v, p, { agora: store.agora(), cadastroNaVisita: store.cadastroNaVisita(v), sit: store.situacao(p.id) });
    if (s) store.confirmarProximaAcao(v.id, { ...s, sugerida: true });
  }

  tudo();
  const desmontarVoz = montarGravador(main.querySelector('#voz'), store, v, { aoMudar: () => { if (document.body.contains(main)) render(); } });
  if (v.checkin.lat == null && !v.checkin.gps_erro && !v.checkout) pedirGps();
  const t = setInterval(atualizarRelogio, 15000);
  return () => { clearInterval(t); desmontarVoz?.(); };
}
