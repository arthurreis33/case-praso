// Hoje (seções 6.1 a 6.3). Tela inicial. Pergunta que responde: "para onde vou agora e o que faço lá?"
//  · cabeçalho de 2 linhas e, logo abaixo, a rota do dia (8 a 12 pontos), em ordem, com hora e o porquê;
//  · faixa de pendências FORA da rota (retornos, recompras vencendo, pontos para conhecer), recolhida em chips:
//    o que já está na rota aparece uma vez só, no card ("Volta qui 14h");
//  · tirar/pôr com um toque recalcula a rota; "não couberam" com o motivo; ajustes da rota ficam no Perfil;
//  · "Abrir rota no Maps" (só deep link) e "Replanejar daqui".
import { esc, toast, hora, quando, mapsRotaUrl, janelaTexto } from '../ui.js';
import { icone } from '../icones.js';
import { cardPonto, linhaCompacta } from './componentes.js';
import { linkCarteira } from './carteira.js';
import { gerarPlano, chaveDia, diaDoPlano } from '../plano.js';
import { avaliarPrioridade } from '../prioridade.js';
import { obterPosicao } from '../geo.js';
import { nomeDe } from '../store.js';
import { modeloPara, enviarWhatsApp } from '../whatsapp.js';

let buscaAdd = '';
let pendAberta = null; // qual pendência está aberta (uma por vez)

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
  const ps = store.meusPontos();
  const dataPl = new Date(pl.inicio);
  const noPlano = new Set(pl.paradas.map((x) => x.id));
  const feitos = new Set(pl.feitos || []);

  // ---------- pendências: só o que NÃO está na rota (o que está aparece uma vez, no card) ----------
  const retornos = ps.filter((p) => !noPlano.has(p.id) && !feitos.has(p.id) && p.status_dia === 'retornar' && p.retorno_sugerido && chaveDia(new Date(p.retorno_sugerido)) <= pl.data)
    .sort((a, b) => a.retorno_sugerido.localeCompare(b.retorno_sugerido));
  const recompra = ps.filter((p) => !noPlano.has(p.id) && p.estado === 'ativacao')
    .map((p) => ({ p, a: avaliarPrioridade(store, p) }))
    .filter((x) => x.a.recompraVencendo).sort((x, y) => x.a.sit.prazo.dias_restantes - y.a.sit.prazo.dias_restantes);
  const novos = ps.filter((p) => !noPlano.has(p.id) && (p.verificar || (!p.cnpj && p.origem === 'campo')));
  const desconhecidos = store.estado.desconhecidos.filter((d) => d.status === 'novo').length;

  const btAdd = (p) => `<button type="button" class="acao-c" data-add="${esc(p.id)}" aria-label="Pôr ${esc(nomeDe(p))} na rota de hoje">${icone('mais')}Rota</button>`;
  const PEND = {
    retornos: {
      n: retornos.length, rotulo: `${retornos.length} ${retornos.length === 1 ? 'retorno' : 'retornos'} fora da rota`, ic: 'retorno', cls: 'alerta',
      html: () => retornos.slice(0, 6).map((p) => linhaCompacta(store, p, {
        s: `<b>${esc(new Date(p.retorno_sugerido) < agora ? 'atrasado · ' : '')}${esc(quando(p.retorno_sugerido, agora))}</b>${p.decisor ? ` · ${esc(janelaTexto(p.decisor))}` : ''}`, acao: btAdd(p),
      })).join('') + (retornos.length > 6 ? `<a class="btn mais-link" href="${linkCarteira('retornar')}">Ver os ${retornos.length} na Carteira</a>` : ''),
    },
    recompra: {
      n: recompra.length, rotulo: `${recompra.length} ${recompra.length === 1 ? 'recompra vencendo' : 'recompras vencendo'}`, ic: 'ativacao', cls: 'ativ',
      html: () => recompra.slice(0, 5).map(({ p, a }) => linhaCompacta(store, p, {
        s: esc(a.motivos.slice(1).join(' · ')), acao: `<button type="button" class="acao-c zap" data-zap="${esc(p.id)}" aria-label="Mensagem de recompra para ${esc(nomeDe(p))} pelo WhatsApp">${icone('whatsapp')}WhatsApp</button>`,
      })).join('') + (recompra.length > 5 ? `<a class="btn mais-link" href="${linkCarteira('prazo')}">Ver as ${recompra.length} na Carteira</a>` : ''),
    },
    novos: {
      n: novos.length + desconhecidos, rotulo: `${novos.length + desconhecidos} para conhecer`, ic: 'busca', cls: 'info',
      html: () => `${novos.slice(0, 4).map((p) => linhaCompacta(store, p, { s: 'sem CNPJ: confirmar no ponto', acao: btAdd(p) })).join('')}
        ${novos.length > 4 ? `<a class="btn mais-link" href="${linkCarteira('verificar')}">Ver os ${novos.length} sem CNPJ na Carteira</a>` : ''}
        ${desconhecidos ? `<a class="btn mais-link" href="#/descobrir">${icone('busca')}${desconhecidos} perto de você, fora da carteira</a>` : ''}`,
    },
  };
  if (pendAberta && !PEND[pendAberta]?.n) pendAberta = null;
  const chipsPend = Object.entries(PEND).filter(([, x]) => x.n)
    .map(([k, x]) => `<button type="button" class="pend ${x.cls}" data-pend="${k}" aria-expanded="${pendAberta === k}">${icone(x.ic)}<span>${esc(x.rotulo)}</span></button>`).join('');

  const tituloDia = dataPl.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const resumo = [`${pl.paradas.length} paradas`, `${String(pl.km).replace('.', ',')} km`, `volta ~${hora(pl.fim_previsto)}`].join(' · ');

  main.innerHTML = `
    <div class="cab-dia">
      <h1>${pl.amanha ? 'Amanhã' : 'Hoje'} <span class="data-dia">${esc(tituloDia)}</span></h1>
      ${pl.amanha ? '<p class="aviso-dia">Seu dia acabou. Este é o plano de amanhã.</p>' : ''}
      <p class="resumo-dia">${esc(resumo)} · <b>≈${String(pl.esperados_total).replace('.', ',')} pt prováveis</b></p>
    </div>
    ${chipsPend ? `<div class="pendencias" role="group" aria-label="Fora da rota">${chipsPend}</div>` : ''}
    ${pendAberta ? `<section class="painel-pend ${PEND[pendAberta].cls}">${PEND[pendAberta].html()}</section>` : ''}

    <h2 class="titulo-rota">Sua rota</h2>
    ${pl.paradas.map((x) => {
      const p = store.ponto(x.id);
      if (!p) return '';
      return cardPonto(store, p, {
        ordem: x.ordem, eta: hora(x.chegada), motivo: x.motivo, ultimaVez: true,
        sub: feitos.has(p.id) ? 'Visitado hoje' : x.espera_min ? `Espera ${x.espera_min} min` : null,
        lado: `<button type="button" data-tirar="${esc(p.id)}" aria-label="Tirar ${esc(nomeDe(p))} da rota">${icone('tirar')}<span>Tirar</span></button>`,
      });
    }).join('') || '<div class="vazio-box"><p><b>Nada coube na jornada.</b></p><p class="sutil">Replaneje a partir de onde você está ou mude o deslocamento no Perfil.</p></div>'}

    ${feitos.size ? `<details class="dobra"><summary>Visitados hoje (${feitos.size})</summary>${[...feitos].map((id) => store.ponto(id)).filter(Boolean).map((p) => cardPonto(store, p)).join('')}</details>` : ''}
    ${pl.nao_couberam.length ? `<details class="dobra"><summary>Não couberam (${pl.nao_couberam.length})</summary>
      ${pl.nao_couberam.map((x) => { const p = store.ponto(x.id); return p ? cardPonto(store, p, { motivo: `Não coube: ${x.motivo}` }) : ''; }).join('')}</details>` : ''}

    <details class="dobra" id="add"${buscaAdd ? ' open' : ''}>
      <summary>Pôr outro ponto na rota</summary>
      <input type="search" id="busca-add" placeholder="Buscar na carteira pelo nome" value="${esc(buscaAdd)}" aria-label="Buscar ponto para pôr na rota">
      <div id="res-add"></div>
    </details>
    <a class="btn mais-link discreto" href="#/perfil">${icone('rota')}Deslocamento, base e jornada</a>`;

  const url = mapsRotaUrl(pl.paradas.filter((x) => !feitos.has(x.id)).map((x) => store.ponto(x.id)).filter(Boolean));
  barra.innerHTML = `
    ${url ? `<a class="btn primaria grande" href="${esc(url)}" target="_blank" rel="noopener">${icone('navegar')}Abrir rota no Maps</a>` : ''}
    <button class="btn grande" data-acao-h="replanejar">${icone('mira')}Replanejar daqui</button>`;

  // ---------- pôr na rota pela busca ----------
  const elRes = main.querySelector('#res-add');
  const listarAdd = () => {
    const q = buscaAdd.trim().toLowerCase();
    if (q.length < 2) { elRes.innerHTML = '<p class="dica">Digite 2 letras do nome.</p>'; return; }
    const r = ps.filter((p) => !noPlano.has(p.id) && nomeDe(p).toLowerCase().includes(q)).slice(0, 8);
    elRes.innerHTML = r.map((p) => cardPonto(store, p, { lado: `<button type="button" data-add="${esc(p.id)}" aria-label="Pôr ${esc(nomeDe(p))} na rota de hoje">${icone('mais')}<span>Rota</span></button>` })).join('') || '<p class="sutil">Nada encontrado.</p>';
  };
  main.querySelector('#busca-add').addEventListener('input', (e) => { buscaAdd = e.target.value; listarAdd(); });
  listarAdd();

  const replan = (opts = {}) => replanejar(store, opts);

  const onClick = async (ev) => {
    const pd = ev.target.closest('[data-pend]')?.dataset.pend;
    if (pd) { pendAberta = pendAberta === pd ? null : pd; return render(); }
    const t = ev.target.closest('[data-tirar]')?.dataset.tirar;
    if (t) {
      const ant = store.estado.plano_dia;
      replan({ removidos: [...(ant.removidos || []), t], adicionados: (ant.adicionados || []).filter((x) => x !== t) });
      toast('Tirado da rota · rota recalculada');
      return render();
    }
    const a = ev.target.closest('[data-add]')?.dataset.add;
    if (a) {
      const ant = store.estado.plano_dia;
      const novo = replan({ adicionados: [...(ant.adicionados || []), a], removidos: (ant.removidos || []).filter((x) => x !== a) });
      const entrou = novo.paradas.some((x) => x.id === a);
      toast(entrou ? 'Na rota · rota recalculada' : `Não coube: ${novo.nao_couberam.find((x) => x.id === a)?.motivo || 'sem espaço na jornada'}`, 3500);
      return render();
    }
    const z = ev.target.closest('[data-zap]')?.dataset.zap;
    if (z) { const p = store.ponto(z); enviarWhatsApp(store, p, modeloPara(p.estado)); toast('Contato registrado na ficha'); return; }
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
