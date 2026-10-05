// Tela da visita: check-in (RF05) → observação → núcleo de 3 toques (RF06) → pesquisa na ordem
// do roteiro (RF07) → surpresa (RF08) → check-out (RF09). Laço (RF10) e relógios (RF11) no store.
// Tudo é gravado no toque; nenhum botão espera rede.
import * as C from '../catalogo.js';
import { esc, chips, alternarChip, quando, hora, duracao, toast } from '../ui.js';
import { obterPosicao } from '../geo.js';
import { duracoes } from '../rules.js';

const pedindoGps = new Set();
const R = C.rotulo;

function pergunta(n, titulo, fala, corpo) {
  return `<div class="pergunta"><h3>${n} · ${titulo}</h3><p class="roteiro">“${fala}”</p>${corpo}</div>`;
}
const texto = (campo, valor, ph = '') =>
  `<textarea data-campo="${campo}" rows="2" placeholder="${esc(ph)}">${esc(valor || '')}</textarea>`;
const rotuloCampo = (t) => `<p class="passo">${t}</p>`;

function htmlPesquisa(v) {
  const q = v.pesquisa || {};
  const g = (path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), q);
  return `
  ${pergunta(1, 'Contexto', 'Há quanto tempo vocês estão aqui? O que mais sai?', '<p class="dica">Aquecimento. Sem campo.</p>')}
  ${pergunta(2, 'Papéis', 'Quem decide o que comprar? Quem paga os fornecedores? Quem recebe a mercadoria?',
    `<p class="dica">Quem decide já está no registro acima.</p>
     ${rotuloCampo('Quem paga os fornecedores')}${chips('pesquisa.papeis.quem_paga', C.QUEM_PAGA, g('papeis.quem_paga'))}
     ${rotuloCampo('Quem recebe a mercadoria')}${chips('pesquisa.papeis.quem_recebe', C.QUEM_RECEBE, g('papeis.quem_recebe'))}`)}
  ${pergunta(3, 'Última compra', 'Me conta a última compra de insumo de vocês: o que foi, de quem, como pediram, quando chegou. E a anterior, foi parecida?',
    `${rotuloCampo('Canal')}${chips('pesquisa.ultima_compra.canal', C.CANAIS, g('ultima_compra.canal'))}
     ${rotuloCampo('De quem')}${texto('pesquisa.ultima_compra.de_quem', g('ultima_compra.de_quem'), 'Fornecedor, atacarejo, representante…')}
     ${rotuloCampo('A anterior foi parecida?')}${chips('pesquisa.ultima_compra.anterior_parecida', C.SIM_NAO_NS, g('ultima_compra.anterior_parecida'))}`)}
  ${pergunta(4, 'Fornecedores', 'De quantos lugares vocês compram hoje, e o que vem de cada um? Qual deu mais dor de cabeça no último mês? O que aconteceu?',
    `${rotuloCampo('Quantos fornecedores')}${chips('pesquisa.fornecedores.quantos', C.N_FORNECEDORES, g('fornecedores.quantos'), { classe: 'compacto' })}
     ${rotuloCampo('Qual deu dor de cabeça e o que aconteceu')}${texto('pesquisa.fornecedores.dor_de_cabeca', g('fornecedores.dor_de_cabeca'))}`)}
  ${pergunta(5, 'Última troca', 'Quando foi a última vez que começaram a comprar de alguém novo? O que fez mudar? O que quase fez desistir?',
    `${rotuloCampo('Quando foi')}${chips('pesquisa.ultima_troca.quando', C.ULTIMA_TROCA, g('ultima_troca.quando'))}
     ${rotuloCampo('O que fez mudar')}${texto('pesquisa.ultima_troca.o_que_fez_mudar', g('ultima_troca.o_que_fez_mudar'))}
     ${rotuloCampo('O que quase fez desistir')}${texto('pesquisa.ultima_troca.quase_desistiu', g('ultima_troca.quase_desistiu'))}`)}
  ${pergunta(6, 'Apps', 'Já compraram insumo por app ou site? … Só depois: já ouviu falar de BEES, Cayena ou Praso? Se usou, como foi a primeira compra?',
    `${rotuloCampo('Espontâneo · já comprou por app ou site?')}${chips('pesquisa.apps.espontaneo.ja_comprou', C.SIM_NAO, g('apps.espontaneo.ja_comprou'))}
     ${texto('pesquisa.apps.espontaneo.qual', g('apps.espontaneo.qual'), 'Qual? (só se ele citou)')}
     ${rotuloCampo('Estimulado · conhece')}${chips('pesquisa.apps.estimulado.conhece', C.APPS, g('apps.estimulado.conhece'), { multi: true, exclusivo: 'nenhum' })}
     ${rotuloCampo('Usou')}${chips('pesquisa.apps.estimulado.usou', C.APPS.filter(([a]) => a !== 'nenhum'), g('apps.estimulado.usou'), { multi: true })}`)}
  ${pergunta(7, 'Pagamento', 'Como pagaram essa última compra: à vista, boleto, com quantos dias? Já deixaram de comprar de alguém por causa de prazo ou forma de pagamento?',
    `${rotuloCampo('Forma')}${chips('pesquisa.pagamento.forma', C.FORMAS_PAGAMENTO, g('pagamento.forma'))}
     ${rotuloCampo('Prazo')}${chips('pesquisa.pagamento.prazo', C.PRAZOS, g('pagamento.prazo'))}
     ${rotuloCampo('Já deixou de comprar por prazo ou pagamento?')}${chips('pesquisa.pagamento.deixou_de_comprar', C.SIM_NAO, g('pagamento.deixou_de_comprar'))}
     ${texto('pesquisa.pagamento.deixou_texto', g('pagamento.deixou_texto'), 'De quem e o que aconteceu')}`)}
  ${pergunta(8, 'Fechamento', 'Posso voltar outro dia? Qual horário é melhor? Tem alguém aqui perto que eu deveria ouvir?',
    `${rotuloCampo('Posso voltar?')}${chips('pesquisa.fechamento.pode_voltar', C.SIM_NAO, g('fechamento.pode_voltar'))}
     ${rotuloCampo('Melhor horário')}<p class="dica">Marcar um horário manda o ponto para “Retornar”.</p>
     ${chips('pesquisa.fechamento.melhor_horario.faixas', C.FAIXAS, g('fechamento.melhor_horario.faixas'), { multi: true })}
     ${chips('pesquisa.fechamento.melhor_horario.dias', C.DIAS, g('fechamento.melhor_horario.dias'), { multi: true, classe: 'compacto' })}
     ${rotuloCampo('Indicação de outro ponto')}${texto('pesquisa.fechamento.indicacao', g('fechamento.indicacao'), 'Nome e onde fica')}`)}`;
}

export function renderVisita({ main, barra, store, ir }, id) {
  const v = store.visita(id);
  if (!v) return ir('#/');
  const p = store.ponto(v.ponto_id) || { nome: '(ponto removido)' };

  main.innerHTML = `
    <div class="cabecalho-visita">
      <h1>${esc(p.nome)}</h1>
      <div id="relogio" class="sutil"></div>
      <div id="gps" class="gps"></div>
      ${v.retorno_previsto ? `<p class="retorno-previsto">Revisita · sugerido ${esc(quando(v.retorno_previsto.quando))}</p>` : ''}
    </div>

    <h2>0 · Antes de entrar</h2>
    <p class="dica">30 s observando de fora.</p>
    ${chips('observacao', C.OBSERVACOES, v.observacao, { multi: true })}

    <section class="nucleo" aria-label="Registro em 3 toques">
      <h2>Registro · 3 toques</h2>
      ${rotuloCampo('Versão da conversa')}${chips('versao_conversa', C.VERSOES, v.versao_conversa)}
      ${rotuloCampo('1 · Resultado')}${chips('nucleo.resultado', C.RESULTADOS, v.nucleo.resultado)}
      ${rotuloCampo('2 · Quem decide a compra')}${chips('nucleo.quem_decide', C.QUEM_DECIDE, v.nucleo.quem_decide)}
      ${rotuloCampo('3 · Quando o decisor está')}
      ${chips('nucleo.faixas', C.FAIXAS, v.nucleo.faixas, { multi: true })}
      ${chips('nucleo.dias', C.DIAS, v.nucleo.dias, { multi: true, classe: 'compacto' })}
      <p class="dica">Sem dia marcado = qualquer dia.</p>
      <div id="resumo-nucleo" class="resumo-nucleo"></div>
    </section>

    <details class="bloco" id="bloco-pesquisa"${v.pesquisa.inicio ? ' open' : ''}>
      <summary>Pesquisa · roteiro 1 a 8 (opcional)</summary>
      ${htmlPesquisa(v)}
    </details>

    <section class="surpresa">
      <h2>O que me surpreendeu aqui</h2>
      <p class="dica">Depois de sair, antes do próximo ponto. Pode ditar pelo microfone do teclado.</p>
      ${texto('surpresa', v.surpresa)}
      ${rotuloCampo('Registrei os textos por')}${chips('registro_modo', C.MODOS_REGISTRO, v.registro_modo)}
    </section>`;

  // ---- partes dinâmicas ----
  const elRel = main.querySelector('#relogio');
  const elGps = main.querySelector('#gps');
  const elRes = main.querySelector('#resumo-nucleo');

  function atualizarRelogio() {
    const ent = `Check-in ${hora(v.checkin.em)}`;
    if (v.checkout) {
      elRel.textContent = `${ent} · check-out ${hora(v.checkout.em)} · ${duracao(duracoes(v).tempo_no_ponto_s)} no ponto`;
    } else {
      const s = Math.round((Date.now() - new Date(v.checkin.em)) / 1000);
      elRel.textContent = `${ent} · ${Math.floor(s / 60)} min no ponto`;
    }
  }

  function atualizarGps() {
    const c = v.checkin;
    if (c.lat != null) {
      const ruim = c.precisao_m > 50;
      elGps.className = `gps ${ruim ? 'ruim' : 'ok'}`;
      elGps.innerHTML = `GPS ±${c.precisao_m} m${ruim ? ' · precisão baixa <button type="button" class="btn" data-acao="gps">Tentar de novo</button>' : ''}`;
    } else if (pedindoGps.has(v.id)) {
      elGps.className = 'gps'; elGps.textContent = 'Buscando GPS… (pode seguir registrando)';
    } else {
      elGps.className = 'gps erro';
      elGps.innerHTML = `GPS: ${esc(c.gps_erro || 'sem posição')} <button type="button" class="btn" data-acao="gps">Tentar de novo</button>`;
    }
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

  function atualizarResumo() {
    const n = v.nucleo;
    const d = duracoes(v);
    elRes.className = 'resumo-nucleo';
    if (n.fim) {
      const pt = store.ponto(v.ponto_id);
      const destino = pt?.status_dia === 'retornar' && pt.retorno_sugerido
        ? `volta para Retornar · ${quando(pt.retorno_sugerido)} (${pt.retorno_motivo === 'melhor_horario' ? 'horário combinado' : 'janela do decisor'})`
        : 'ponto marcado como visitado';
      elRes.classList.add('ok');
      elRes.textContent = `Registro salvo em ${duracao(d.tempo_nucleo_s)}${d.nucleo_no_ponto === false ? ' (depois de sair)' : ''} · ${destino}`;
    } else if (n.inicio) {
      elRes.textContent = `Registrando desde ${hora(n.inicio)}. ${n.resultado ? 'Toque em Salvar registro.' : 'Falta o resultado.'}`;
    } else {
      elRes.textContent = 'O relógio do registro começa no primeiro toque.';
    }
  }

  function atualizarBarra() {
    const n = v.nucleo;
    const btSalvar = `<button class="btn primaria grande" data-acao="salvar-nucleo"${n.resultado ? '' : ' disabled'}>Salvar registro</button>`;
    if (!v.checkout) {
      barra.innerHTML = n.fim
        ? `<button class="btn primaria grande" data-acao="checkout">Check-out</button>`
        : `${btSalvar}<button class="btn grande" data-acao="checkout">Check-out</button>`;
    } else {
      barra.innerHTML = n.fim
        ? `<button class="btn primaria grande" data-acao="concluir">Concluir</button>`
        : `${btSalvar}<button class="btn grande" data-acao="concluir">Concluir</button>`;
    }
  }

  function tudo() { atualizarRelogio(); atualizarGps(); atualizarResumo(); atualizarBarra(); }

  // ---- eventos ----
  main.addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (b) {
      const g = b.closest('.chips');
      const val = alternarChip(b);
      store.setCampo(v.id, g.dataset.campo, val ?? (g.dataset.multi === '1' ? [] : null));
      atualizarResumo(); atualizarBarra();
      return;
    }
    if (ev.target.closest('[data-acao="gps"]')) pedirGps();
  });
  main.addEventListener('input', (ev) => {
    const t = ev.target.closest('[data-campo]');
    if (t && t.tagName === 'TEXTAREA') store.setCampo(v.id, t.dataset.campo, t.value);
  });

  barra.onclick = (ev) => {
    const acao = ev.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'salvar-nucleo') {
      store.salvarNucleo(v.id);
      const pt = store.ponto(v.ponto_id);
      toast(pt?.status_dia === 'retornar' ? `Volta ${quando(pt.retorno_sugerido)}` : 'Registro salvo');
      atualizarResumo(); atualizarBarra();
    } else if (acao === 'checkout') {
      if (v.nucleo.resultado && !v.nucleo.fim) store.salvarNucleo(v.id);
      store.checkout(v.id);
      toast(v.nucleo.fim ? 'Check-out feito. Agora a surpresa.' : 'Check-out feito. Falta o resultado.');
      tudo();
      main.querySelector('.surpresa')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (acao === 'concluir') {
      ir('#/');
    }
  };

  tudo();
  if (v.checkin.lat == null && !v.checkin.gps_erro && !v.checkout) pedirGps();
  const t = setInterval(atualizarRelogio, 15000);
  return () => clearInterval(t);
}
