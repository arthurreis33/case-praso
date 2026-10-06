// Hoje (seções 6.1 a 6.3). Tela inicial.
//  · três blocos fixos no topo, quando houver itens: retornos com hora, recompra vencendo, pontos novos para verificar;
//  · lista do dia sugerida (8 a 12 pontos), em ordem de rota, com hora prevista e o porquê de cada um;
//  · tirar/adicionar com um toque recalcula a rota; "não couberam" com o motivo;
//  · "Abrir rota no Google Maps" (só deep link) e "Replanejar a partir daqui".
import { MODOS_DESLOCAMENTO } from '../catalogo.js';
import { esc, toast, hora, quando, seloEstado, mapsRotaUrl, janelaTexto } from '../ui.js';
import { cardPonto, linhaCompacta } from './componentes.js';
import { linkCarteira } from './carteira.js';
import { gerarPlano, chaveDia, diaDoPlano } from '../plano.js';
import { avaliarPrioridade } from '../prioridade.js';
import { obterPosicao } from '../geo.js';
import { nomeDe } from '../store.js';
import { modeloPara, enviarWhatsApp } from '../whatsapp.js';

let buscaAdd = '';

function feitosHoje(store, data) {
  return store.estado.visitas.filter((v) => (v.vendedor_id || 'v-voce') === store.estado.config.vendedor_id && chaveDia(new Date(v.checkin.em)) === data).map((v) => v.ponto_id);
}

/** Plano atual (gera se não existir para o dia). */
export function planoAtual(store, { forcar = false, ...opts } = {}) {
  const { dia } = diaDoPlano(store);
  const data = chaveDia(dia);
  let pl = store.estado.plano_dia;
  if (forcar || !pl || pl.data !== data) {
    const ant = pl?.data === data ? pl : null;
    pl = gerarPlano(store, { removidos: ant?.removidos, adicionados: ant?.adicionados, feitos: feitosHoje(store, data), ...opts });
    store.setPlano(pl);
    store.marcarPlanejado(pl.paradas.map((x) => x.id));
  }
  return pl;
}

/** Recalcula o plano do dia mantendo o que o vendedor tirou, pôs e já visitou. */
export function replanejar(store, opts = {}) {
  const ant = store.estado.plano_dia || planoAtual(store);
  const novo = gerarPlano(store, { removidos: ant?.removidos, adicionados: ant?.adicionados, feitos: feitosHoje(store, ant.data), ...opts });
  store.setPlano(novo);
  store.marcarPlanejado(novo.paradas.map((x) => x.id));
  return novo;
}

export function renderHoje({ main, barra, store, render }) {
  if (!store.meusPontos().length) return boasVindas({ main, barra });
  const agora = store.agora();
  const pl = planoAtual(store);
  const vend = store.vendedor();
  const ps = store.meusPontos();
  const dataPl = new Date(pl.inicio);

  // ---------- blocos fixos ----------
  const retornos = ps.filter((p) => p.status_dia === 'retornar' && p.retorno_sugerido && chaveDia(new Date(p.retorno_sugerido)) <= pl.data)
    .sort((a, b) => a.retorno_sugerido.localeCompare(b.retorno_sugerido));
  const recompra = ps.map((p) => ({ p, a: ['ativacao'].includes(p.estado) ? avaliarPrioridade(store, p) : null }))
    .filter((x) => x.a?.recompraVencendo).sort((x, y) => x.a.sit.prazo.dias_restantes - y.a.sit.prazo.dias_restantes);
  const novos = ps.filter((p) => p.verificar || (!p.cnpj && p.origem === 'campo'));
  const desconhecidos = store.estado.desconhecidos.filter((d) => d.status === 'novo').length;

  const noPlano = new Set(pl.paradas.map((x) => x.id));
  const feitos = new Set(pl.feitos || []);
  const acaoLista = (p) => (noPlano.has(p.id)
    ? '<span class="ok-c">na rota</span>'
    : `<button type="button" class="acao-c" data-add="${esc(p.id)}" aria-label="Adicionar ${esc(nomeDe(p))} à lista">+ lista</button>`);
  const blocoItem = (p, extra = {}) => cardPonto(store, p, {
    ...extra,
    lado: noPlano.has(p.id) ? '<span class="sutil" style="font-size:.8rem;color:var(--ok)">na rota</span>' : `<button type="button" data-add="${esc(p.id)}" aria-label="Adicionar ${esc(nomeDe(p))} à lista de hoje">+ lista</button>`,
  });

  const bloco = (cls, titulo, itens, html, vazio = false) => (itens.length || vazio ? `
    <section class="bloco-topo ${cls}"><h2><span>${titulo}</span><span class="num">${itens.length}</span></h2>
      <div class="itens">${html}</div></section>` : '');

  main.innerHTML = `
    <h1>${pl.amanha ? 'Amanhã' : 'Hoje'} <span class="sutil">· ${esc(dataPl.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }))}</span></h1>
    <p class="sutil">${pl.amanha ? 'Seu dia acabou. Este é o plano de amanhã. ' : ''}Saída ${esc(hora(pl.inicio))} · ${esc(MODOS_DESLOCAMENTO.find(([k]) => k === pl.modo)?.[1] || pl.modo)} · ${pl.paradas.length} paradas · ${String(pl.km).replace('.', ',')} km · volta ~${esc(hora(pl.fim_previsto))} · <b>≈${String(pl.esperados_total).replace('.', ',')} pt esperados</b></p>

    ${bloco('retornos', 'Retornos com hora', retornos, retornos.slice(0, 5).map((p) => linhaCompacta(store, p, {
      s: `<b>${esc(new Date(p.retorno_sugerido) < agora ? 'atrasado · ' : '')}${esc(quando(p.retorno_sugerido, agora))}</b> · ${esc(janelaTexto(p.decisor) || 'retorno combinado')}`, acao: acaoLista(p),
    })).join('') + (retornos.length > 5 ? `<a class="btn mais-link" href="${linkCarteira('retornar')}">Ver os ${retornos.length} retornos na Carteira</a>` : ''))}
    ${bloco('recompra', 'Recompra vencendo', recompra, recompra.slice(0, 3).map(({ p, a }) => linhaCompacta(store, p, {
      s: esc(a.motivos.slice(1).join(' · ')), acao: `<button type="button" class="acao-c" data-zap="${esc(p.id)}" aria-label="Mensagem de recompra para ${esc(nomeDe(p))} pelo WhatsApp">WhatsApp</button>`,
    })).join('') + (recompra.length > 3 ? `<a class="btn mais-link" href="${linkCarteira('prazo')}">Ver as ${recompra.length} na Carteira</a>` : ''))}
    ${bloco('novos', 'Pontos novos para verificar', novos.length || desconhecidos ? [...novos, ...Array(desconhecidos)] : [],
      `${novos.slice(0, 2).map((p) => linhaCompacta(store, p, { s: 'sem CNPJ: verificar no campo', acao: acaoLista(p) })).join('')}
       ${desconhecidos ? `<a class="btn" href="#/descobrir" style="width:100%;margin:8px 0">Descobrir: ${desconhecidos} fora da carteira</a>` : ''}`)}

    <div class="secao-titulo"><h2>Lista do dia · em ordem de rota</h2><span class="sutil">${pl.paradas.length}</span></div>
    ${pl.paradas.map((x) => {
      const p = store.ponto(x.id);
      if (!p) return '';
      return cardPonto(store, p, {
        ordem: x.ordem, eta: hora(x.chegada), esperados: x.esperados, motivo: x.motivo,
        sub: feitos.has(p.id) ? 'visitado hoje' : x.espera_min ? `espera ${x.espera_min} min` : null,
        lado: `<button type="button" data-tirar="${esc(p.id)}" aria-label="Tirar ${esc(nomeDe(p))} da lista">Tirar</button>`,
      });
    }).join('') || '<p class="vazio">Nada coube na jornada. Tente replanejar ou trocar o deslocamento.</p>'}

    ${feitos.size ? `<details class="dobra"><summary>Visitados hoje (${feitos.size})</summary>${[...feitos].map((id) => store.ponto(id)).filter(Boolean).map((p) => cardPonto(store, p)).join('')}</details>` : ''}
    ${pl.nao_couberam.length ? `<details class="dobra"><summary>Não couberam (${pl.nao_couberam.length})</summary>
      ${pl.nao_couberam.map((x) => { const p = store.ponto(x.id); return p ? cardPonto(store, p, { motivo: `Não coube: ${x.motivo}` }) : ''; }).join('')}</details>` : ''}

    <details class="dobra" id="add">
      <summary>Adicionar ponto à lista</summary>
      <input type="search" id="busca-add" placeholder="Buscar na carteira" value="${esc(buscaAdd)}" aria-label="Buscar ponto para adicionar">
      <div id="res-add"></div>
    </details>

    <a class="btn mais-link" href="#/perfil">Ajustar deslocamento e base</a>`;

  const url = mapsRotaUrl(pl.paradas.filter((x) => !feitos.has(x.id)).map((x) => store.ponto(x.id)).filter(Boolean));
  barra.innerHTML = `
    ${url ? `<a class="btn primaria grande" href="${esc(url)}" target="_blank" rel="noopener">Abrir rota no Maps</a>` : ''}
    <button class="btn grande" data-acao-h="replanejar">Replanejar daqui</button>`;

  // ---------- adicionar ----------
  const elRes = main.querySelector('#res-add');
  const listarAdd = () => {
    const q = buscaAdd.trim().toLowerCase();
    if (q.length < 2) { elRes.innerHTML = '<p class="dica">Digite 2 letras do nome.</p>'; return; }
    const r = ps.filter((p) => !noPlano.has(p.id) && nomeDe(p).toLowerCase().includes(q)).slice(0, 8);
    elRes.innerHTML = r.map((p) => blocoItem(p)).join('') || '<p class="sutil">Nada encontrado.</p>';
  };
  main.querySelector('#busca-add').addEventListener('input', (e) => { buscaAdd = e.target.value; listarAdd(); });
  listarAdd();

  const replan = (opts = {}) => replanejar(store, opts);

  const onClick = async (ev) => {
    const t = ev.target.closest('[data-tirar]')?.dataset.tirar;
    if (t) {
      const ant = store.estado.plano_dia;
      replan({ removidos: [...(ant.removidos || []), t], adicionados: (ant.adicionados || []).filter((x) => x !== t) });
      toast('Tirado da lista · rota recalculada');
      return render();
    }
    const a = ev.target.closest('[data-add]')?.dataset.add;
    if (a) {
      const ant = store.estado.plano_dia;
      const novo = replan({ adicionados: [...(ant.adicionados || []), a], removidos: (ant.removidos || []).filter((x) => x !== a) });
      const entrou = novo.paradas.some((x) => x.id === a);
      toast(entrou ? 'Adicionado · rota recalculada' : `Não coube: ${novo.nao_couberam.find((x) => x.id === a)?.motivo || 'sem espaço na jornada'}`, 3500);
      return render();
    }
    const z = ev.target.closest('[data-zap]')?.dataset.zap;
    if (z) { const p = store.ponto(z); enviarWhatsApp(store, p, modeloPara(p.estado)); toast('Contato registrado sozinho'); return; }
    const h = ev.target.closest('[data-acao-h]')?.dataset.acaoH;
    if (h === 'replanejar') {
      toast('Buscando sua posição…');
      let origem = null;
      try { const pos = await obterPosicao({ maximumAge: 60000, timeout: 8000 }); origem = { lat: pos.lat, lng: pos.lng }; } catch { /* sem GPS: parte da última visita ou da base */ }
      if (!origem) {
        const ult = store.estado.visitas.filter((v) => v.checkin.lat != null).sort((x, y) => y.checkin.em.localeCompare(x.checkin.em))[0];
        if (ult) origem = { lat: ult.checkin.lat, lng: ult.checkin.lng };
      }
      const agoraR = store.agora();
      const novo = replan({ origem: origem || undefined, inicio: agoraR > new Date(pl.inicio) ? agoraR : undefined });
      toast(`Replanejado a partir de ${origem ? 'onde você está' : 'a base'}, ${hora(agoraR.toISOString())} · ${novo.paradas.length} paradas`, 3500);
      return render();
    }
  };
  main.addEventListener('click', onClick);
  barra.onclick = onClick;
  return () => {};
}


/** Carteira vazia: boas-vindas com o primeiro passo. */
function boasVindas({ main, barra }) {
  main.innerHTML = `
    <div class="boas-vindas">
      <h1>Bem-vindo ao Campo Praso</h1>
      <p>Comece pelos pontos do seu bairro. Cada visita registrada monta a lista de amanhã.</p>
      <div class="pilha">
        <a class="btn primaria grande" href="#/novo/gps">Cadastrar o ponto onde estou</a>
        <a class="btn grande" href="#/novo">Adicionar ponto pelo CNPJ</a>
        <a class="btn grande" href="#/mapa">Ver o mapa</a>
      </div>
      <p class="sutil" style="margin-top:24px">Quer treinar antes?</p>
      <button type="button" class="btn" data-acao="carregar-exemplo" style="width:100%">Ver com dados de exemplo</button>
    </div>`;
  barra.innerHTML = '';
}
