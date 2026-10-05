// Adicionar ponto (seção 6.5) e editar cadastro.
//  · CNPJ → BrasilAPI preenche razão social, nome fantasia, endereço, CNAE, situação e MEI.
//    Sem rede, o vendedor preenche à mão: nada bloqueia.
//  · Sem CNPJ: cria e marca "verificar depois".
//  · Deduplicação: a menos de 50 m e com nome parecido (ou mesmo CNPJ), pergunta "é este?" antes de criar.
import { TIPOS, QUEM_PAGA_PONTO, DIAS } from '../catalogo.js';
import { esc, chips, alternarChip, toast, hora, seloEstado } from '../ui.js';
import { obterPosicao } from '../geo.js';
import { CONFIG } from '../config.js';
import { coordDe, distanciaM, similaridade } from '../rules.js';
import { nomeDe, limparCnpj } from '../store.js';

const CNAE_TIPO = { 5611201: 'restaurante', 5611203: 'lanchonete', 5611204: 'bar', 5611205: 'bar', 1091102: 'padaria', 4721102: 'padaria', 5620104: 'outro' };

export async function buscarCnpj(cnpj, { timeout = 6000 } = {}) {
  const d = limparCnpj(cnpj);
  if (!d || d.length !== 14) throw new Error('CNPJ precisa de 14 dígitos');
  if (!navigator.onLine) throw new Error('sem rede: preencha à mão');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`, { signal: ctrl.signal });
    if (r.status === 404) throw new Error('CNPJ não encontrado na Receita');
    if (!r.ok) throw new Error(`BrasilAPI respondeu ${r.status}`);
    const j = await r.json();
    return {
      razao_social: j.razao_social || null,
      nome_fantasia: j.nome_fantasia || '',
      endereco_cadastral: [[j.descricao_tipo_de_logradouro, j.logradouro].filter(Boolean).join(' '), j.numero, j.bairro, j.municipio, j.uf, j.cep].filter(Boolean).join(', '),
      cnae: j.cnae_fiscal ? `${String(j.cnae_fiscal).replace(/^(\d{4})(\d)(\d{2})$/, '$1-$2/$3')} ${j.cnae_fiscal_descricao || ''}`.trim() : null,
      situacao: (j.descricao_situacao_cadastral || '').toLowerCase() || null,
      mei: typeof j.opcao_pelo_mei === 'boolean' ? j.opcao_pelo_mei : null,
      tipo: CNAE_TIPO[j.cnae_fiscal] || null,
    };
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'BrasilAPI demorou: preencha à mão' : e.message);
  } finally { clearTimeout(t); }
}

/** Candidatos a duplicata: mesmo CNPJ, ou < 50 m com nome parecido. */
export function duplicatas(pontos, { cnpj, nome, coord }, cfg = CONFIG) {
  const d = limparCnpj(cnpj);
  return pontos.map((p) => {
    if (d && p.cnpj === d) return { p, motivo: 'mesmo CNPJ' };
    const c = coordDe(p);
    const sim = similaridade(nome, nomeDe(p));
    if (coord && c) {
      const dist = distanciaM(c.lat, c.lng, coord.lat, coord.lng);
      if (dist <= cfg.limiar_dedup_m && sim >= cfg.limiar_dedup_nome) return { p, motivo: `a ${dist} m, nome parecido` };
    } else if (sim >= 0.85) return { p, motivo: 'nome quase igual' };
    return null;
  }).filter(Boolean).slice(0, 4);
}

export function renderNovo({ main, barra, store, ir, params }, { id = null, gps = false } = {}) {
  const p = id ? store.ponto(id) : null;
  if (id && !p) return ir('#/carteira', true);
  let pos = params.lat ? { lat: +params.lat, lng: +params.lng, precisao_m: null, origem: 'manual' } : null;
  let dadosCnpj = {};
  const base = p || { nome_fantasia: '', tipo: null, endereco_cadastral: '', cnpj: '' };
  const hf = p?.horario_funcionamento;

  main.innerHTML = `
    <h1>${p ? 'Editar cadastro' : gps ? 'Novo ponto aqui' : 'Adicionar ponto'}</h1>
    ${gps && !pos ? '<p id="gps-status" class="gps">Buscando sua localização…</p>' : ''}
    ${pos ? `<p class="gps ok">Posição marcada no mapa · ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}</p>` : ''}
    <form id="f-ponto" autocomplete="off">
      <label class="campo" for="f-cnpj">CNPJ</label>
      <div class="linha-btns"><input id="f-cnpj" type="text" name="cnpj" inputmode="numeric" value="${esc(base.cnpj || '')}" placeholder="Só números" style="flex:1"><button type="button" class="btn" data-acao-n="buscar" style="flex:0 0 auto">Buscar</button></div>
      <p id="cnpj-status" class="dica">Com 14 dígitos, a plataforma busca na Receita (BrasilAPI). Sem rede, preencha à mão.</p>
      <div id="cnpj-res"></div>
      <label class="campo" for="f-nome">Nome fantasia</label>
      <input id="f-nome" type="text" name="nome" value="${esc(base.nome_fantasia)}" placeholder="Como está na fachada" enterkeyhint="next">
      <div class="campo">Tipo</div>
      ${chips('tipo', TIPOS, base.tipo)}
      <label class="campo" for="f-end">Endereço</label>
      <input id="f-end" type="text" name="endereco" value="${esc(base.endereco_cadastral)}" placeholder="Rua, número, bairro" enterkeyhint="done">
      ${p ? `
      <details class="bloco"${p.quem_paga || hf ? ' open' : ''}>
        <summary>Informações de campo (opcionais)</summary>
        <div class="campo">Quem paga os fornecedores</div>
        ${chips('quem_paga', QUEM_PAGA_PONTO, p.quem_paga)}
        <div class="campo">Horário de funcionamento</div>
        <div class="linha-btns"><label class="sutil" style="flex:1">Abre<input type="time" id="f-abre" value="${esc(hf?.faixas?.[0]?.[0] || '')}"></label><label class="sutil" style="flex:1">Fecha<input type="time" id="f-fecha" value="${esc(hf?.faixas?.[0]?.[1] || '')}"></label></div>
        ${chips('dias_abre', DIAS, hf?.dias || [], { multi: true, classe: 'compacto' })}
        <p class="dica">Vazio = usa o padrão do tipo. Alimenta a rota e a priorização.</p>
      </details>` : ''}
      <p class="sutil">Não registre nome nem telefone pessoal do dono.</p>
    </form>
    <div id="dedup"></div>`;

  barra.innerHTML = p
    ? '<button class="btn primaria grande" data-acao-n="salvar">Salvar</button>'
    : gps
      ? '<button class="btn primaria grande" data-acao-n="salvar-checkin">Salvar e check-in</button><button class="btn grande" data-acao-n="salvar">Só salvar</button>'
      : '<button class="btn primaria grande" data-acao-n="salvar">Salvar</button><button class="btn grande" data-acao-n="sem-cnpj">Sem CNPJ</button>';

  main.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => alternarChip(b)));
  const fc = main.querySelector('#f-cnpj');
  const st = main.querySelector('#cnpj-status');

  if (gps && !pos) {
    const g = main.querySelector('#gps-status');
    obterPosicao({ maximumAge: 10000 })
      .then((r) => { pos = { ...r, origem: 'gps_criacao' }; g.className = `gps ${r.precisao_m <= 30 ? 'ok' : 'ruim'}`; g.textContent = `Localização capturada · ±${Math.round(r.precisao_m)} m`; })
      .catch((e) => { g.className = 'gps erro'; g.textContent = `GPS: ${e.message}. O ponto será salvo sem coordenada; o check-in tenta de novo.`; });
  }

  async function buscar() {
    st.textContent = 'Buscando na Receita…';
    try {
      dadosCnpj = await buscarCnpj(fc.value);
      const f = main.querySelector('#f-ponto');
      if (dadosCnpj.nome_fantasia && !f.nome.value) f.nome.value = dadosCnpj.nome_fantasia;
      if (!f.nome.value && dadosCnpj.razao_social) f.nome.value = dadosCnpj.razao_social;
      if (dadosCnpj.endereco_cadastral && !f.endereco.value) f.endereco.value = dadosCnpj.endereco_cadastral;
      if (dadosCnpj.tipo && !main.querySelector('.chips[data-campo="tipo"] [aria-pressed="true"]')) main.querySelector(`.chips[data-campo="tipo"] [data-v="${dadosCnpj.tipo}"]`)?.click();
      st.textContent = 'Preenchido pela Receita (BrasilAPI). Confira.';
      main.querySelector('#cnpj-res').innerHTML = `<div class="caixa"><b>${esc(dadosCnpj.razao_social || '')}</b><div class="sutil">${esc([dadosCnpj.cnae, dadosCnpj.situacao, dadosCnpj.mei === true ? 'MEI' : dadosCnpj.mei === false ? 'não MEI' : ''].filter(Boolean).join(' · '))}</div></div>`;
    } catch (e) {
      dadosCnpj = {};
      st.textContent = e.message;
    }
  }
  fc.addEventListener('input', () => { if (limparCnpj(fc.value)?.length === 14 && !p) buscar(); });

  const ler = () => {
    const f = main.querySelector('#f-ponto');
    const tipo = main.querySelector('.chips[data-campo="tipo"] [aria-pressed="true"]')?.dataset.v || 'outro';
    return {
      nome_fantasia: f.nome.value.trim() || (gps ? `Sem nome · ${hora(new Date().toISOString())}` : ''),
      tipo, endereco_cadastral: f.endereco.value.trim(), cnpj: f.cnpj.value,
    };
  };

  async function salvar(acao, ignorarDup = false) {
    const d = ler();
    if (!d.nome_fantasia) { toast('Dê um nome ao ponto.'); main.querySelector('#f-nome').focus(); return; }
    if (p) {
      const extra = {};
      const qp = main.querySelector('.chips[data-campo="quem_paga"] [aria-pressed="true"]')?.dataset.v || null;
      extra.quem_paga = qp;
      const ab = main.querySelector('#f-abre')?.value, fe = main.querySelector('#f-fecha')?.value;
      const dias = [...main.querySelectorAll('.chips[data-campo="dias_abre"] [aria-pressed="true"]')].map((b) => b.dataset.v);
      extra.horario_funcionamento = ab && fe ? { dias, faixas: [[ab, fe]] } : dias.length ? { dias, faixas: null } : null;
      store.atualizarPonto(p.id, { ...d, ...dadosCnpj, ...d, ...extra, verificar: !limparCnpj(d.cnpj) });
      toast('Cadastro salvo');
      return ir(`#/ponto/${p.id}`, true);
    }
    if (!ignorarDup) {
      const dup = duplicatas(store.meusPontos(), { cnpj: d.cnpj, nome: d.nome_fantasia, coord: pos });
      if (dup.length) return mostrarDup(dup, acao);
    }
    const semCnpj = !limparCnpj(d.cnpj);
    const novo = store.novoPonto({
      ...dadosCnpj, ...d, origem: 'campo', verificar: semCnpj,
      ...(pos ? { coord_confirmada: { lat: pos.lat, lng: pos.lng, precisao_m: pos.precisao_m != null ? Math.round(pos.precisao_m) : null, origem: pos.origem || 'gps_criacao', em: store.agora().toISOString() } } : {}),
    });
    if (acao === 'salvar-checkin') {
      try { const v = store.checkin(novo.id); if (pos?.precisao_m) store.registrarGeo(v.id, pos); return ir(`#/visita/${v.id}`, true); } catch (e) { toast(e.message); }
    }
    toast(semCnpj ? 'Ponto salvo · CNPJ para verificar depois' : 'Ponto salvo');
    ir(`#/ponto/${novo.id}`, true);
  }

  function mostrarDup(dup, acao) {
    const el = main.querySelector('#dedup');
    el.innerHTML = `<div class="caixa alerta" role="alert"><h3>É este?</h3>
      ${dup.map(({ p: x, motivo }) => `<div class="linha-btns" style="align-items:center;margin:6px 0"><span style="flex:2">${esc(nomeDe(x))} ${seloEstado(x.estado)}<br><span class="sutil">${esc(motivo)}</span></span><a class="btn peq" href="#/ponto/${esc(x.id)}" style="flex:1">É este</a></div>`).join('')}
      <button class="btn" data-acao-n="criar-mesmo" data-depois="${esc(acao)}" style="width:100%;margin-top:6px">Não é nenhum: criar novo</button></div>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const onClick = (ev) => {
    const b = ev.target.closest('[data-acao-n]');
    if (!b) return;
    const a = b.dataset.acaoN;
    if (a === 'buscar') return buscar();
    if (a === 'criar-mesmo') return salvar(b.dataset.depois, true);
    if (a === 'sem-cnpj') { fc.value = ''; dadosCnpj = {}; return salvar('salvar'); }
    salvar(a);
  };
  main.addEventListener('click', onClick);
  barra.onclick = onClick;
}

