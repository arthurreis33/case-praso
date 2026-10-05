// RF01 cadastro · RF02 ponto na rua pelo GPS · ficha do ponto com histórico e check-in.
import { TIPOS, ESTADOS, STATUS_DIA, QUEM_DECIDE, FAIXAS, DIAS, RESULTADOS, rotulo } from '../catalogo.js';
import { esc, chips, alternarChip, quando, hora, mapsUrl, toast } from '../ui.js';
import { obterPosicao } from '../geo.js';

const valorChips = (raiz, campo) => {
  const b = raiz.querySelector(`.chips[data-campo="${campo}"] .chip[aria-pressed="true"]`);
  return b ? b.dataset.v : null;
};

// ---------------- Formulário ----------------
export function renderForm({ main, barra, store, ir }, { id = null, gps = false } = {}) {
  const p = id ? store.ponto(id) : null;
  if (id && !p) return ir('#/');
  let pos = null;
  const base = p || { nome: '', tipo: null, endereco: '', cnpj: '', estado: 'lead' };

  main.innerHTML = `
    <h1>${p ? 'Editar ponto' : gps ? 'Novo ponto aqui' : 'Cadastrar ponto'}</h1>
    ${gps ? '<p id="gps-status" class="gps">Buscando sua localização…</p>' : ''}
    <form id="f-ponto" autocomplete="off">
      <label class="campo" for="f-nome">Nome do estabelecimento</label>
      <input id="f-nome" type="text" name="nome" value="${esc(base.nome)}" placeholder="Ex.: Lanchonete da esquina" enterkeyhint="next">
      <div class="campo">Tipo</div>
      ${chips('tipo', TIPOS, base.tipo)}
      <label class="campo" for="f-end">Endereço${gps ? ' (opcional)' : ''}</label>
      <input id="f-end" type="text" name="endereco" value="${esc(base.endereco)}" placeholder="Rua, número, bairro, cidade" enterkeyhint="next">
      <label class="campo" for="f-cnpj">CNPJ (opcional)</label>
      <input id="f-cnpj" type="text" name="cnpj" inputmode="numeric" value="${esc(base.cnpj || '')}" placeholder="Só números">
      <div class="campo">Estado no funil</div>
      ${chips('estado', ESTADOS, base.estado)}
      <p class="sutil">Não registre nome nem telefone pessoal do dono.</p>
    </form>`;

  barra.innerHTML = p
    ? `<button class="btn primaria grande" data-acao="salvar">Salvar</button>`
    : gps
      ? `<button class="btn primaria grande" data-acao="salvar-checkin">Salvar e check-in</button>
         <button class="btn grande" data-acao="salvar">Só salvar</button>`
      : `<button class="btn primaria grande" data-acao="salvar">Salvar</button>
         <button class="btn grande" data-acao="salvar-outro">Salvar + outro</button>`;

  main.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => alternarChip(b)));

  if (gps) {
    const st = main.querySelector('#gps-status');
    obterPosicao({ maximumAge: 10000 })
      .then((r) => {
        pos = r;
        st.className = `gps ${r.precisao_m <= 30 ? 'ok' : 'ruim'}`;
        st.textContent = `Localização capturada · ±${Math.round(r.precisao_m)} m`;
      })
      .catch((e) => {
        st.className = 'gps erro';
        st.textContent = `GPS: ${e.message}. O ponto será salvo sem coordenada; o check-in tenta de novo.`;
      });
  }

  const ler = () => {
    const f = main.querySelector('#f-ponto');
    return {
      nome: f.nome.value.trim() || (gps ? `Sem nome · ${hora(new Date().toISOString())}` : ''),
      tipo: valorChips(main, 'tipo') || 'outro',
      endereco: f.endereco.value,
      cnpj: f.cnpj.value,
      estado: valorChips(main, 'estado') || 'lead',
    };
  };

  barra.onclick = (ev) => {
    const acao = ev.target.closest('[data-acao]')?.dataset.acao;
    if (!acao) return;
    const d = ler();
    if (!d.nome) { toast('Dê um nome ao ponto.'); main.querySelector('#f-nome').focus(); return; }
    if (p) {
      store.atualizarPonto(p.id, d);
      toast('Ponto salvo');
      return ir(`#/ponto/${p.id}`, true);
    }
    const novo = store.novoPonto({
      ...d, origem: gps ? 'rua' : 'lista',
      ...(pos ? { lat: pos.lat, lng: pos.lng, precisao_m: pos.precisao_m, coord_fonte: 'gps_criacao' } : {}),
    });
    if (acao === 'salvar-checkin') {
      try {
        const v = store.checkin(novo.id);
        if (pos) store.registrarGeo(v.id, pos);
        return ir(`#/visita/${v.id}`, true);
      } catch (e) { toast(e.message); return ir(`#/ponto/${novo.id}`, true); }
    }
    if (acao === 'salvar-outro') {
      toast(`${novo.nome} salvo. Próximo.`);
      return renderForm({ main, barra, store, ir }, {});
    }
    toast('Ponto salvo');
    ir(gps ? `#/ponto/${novo.id}` : '#/', true);
  };
}

// ---------------- Ficha do ponto ----------------
export function renderPonto({ main, barra, store, ir }, id) {
  const p = store.ponto(id);
  if (!p) return ir('#/');
  const agora = new Date();
  const visitas = store.visitasDo(p.id);
  const aberta = store.visitaAberta();

  const coord = p.lat != null
    ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)} · ±${p.precisao_m ?? '?'} m · ${p.coord_fonte === 'checkin' ? 'do check-in' : 'da criação'}`
    : 'sem coordenada (vem no check-in)';
  const dec = p.decisor
    ? [rotulo(QUEM_DECIDE, p.decisor.quem), (p.decisor.faixas || []).map((f) => rotulo(FAIXAS, f)).join(', '),
      (p.decisor.dias || []).map((d) => rotulo(DIAS, d)).join(' ')].filter(Boolean).join(' · ')
    : 'ainda não sabemos';

  main.innerHTML = `
    <h1>${esc(p.nome)}${p.ficticio ? ' <span class="selo">fictício</span>' : ''}</h1>
    <p class="sutil">${esc(rotulo(TIPOS, p.tipo))} · ${p.origem === 'rua' ? 'criado na rua' : 'da lista'}</p>
    ${p.status_dia === 'retornar' && p.retorno_sugerido
      ? `<p class="retorno-previsto">Voltar ${esc(quando(p.retorno_sugerido, agora))} · ${p.retorno_motivo === 'melhor_horario' ? 'horário combinado' : 'janela do decisor'}</p>` : ''}
    <dl class="ficha">
      <dt>Endereço</dt><dd>${esc(p.endereco || '–')}</dd>
      <dt>CNPJ</dt><dd>${esc(p.cnpj || '–')}</dd>
      <dt>Pino</dt><dd>${esc(coord)}</dd>
      <dt>Decisor</dt><dd>${esc(dec)}</dd>
    </dl>
    <h2>Status do dia</h2>
    ${chips('status_dia', STATUS_DIA, p.status_dia)}
    <h2>Estado no funil</h2>
    ${chips('estado', ESTADOS, p.estado)}
    <div class="linha-btns" style="margin-top:16px">
      <a class="btn" href="${esc(mapsUrl(p))}" target="_blank" rel="noopener">Rota no Maps</a>
      <a class="btn" href="#/ponto/${p.id}/editar">Editar</a>
    </div>
    <h2>Visitas (${visitas.length})</h2>
    <div class="hist">${visitas.map((v) => `<a href="#/visita/${v.id}">
      ${esc(quando(v.checkin.em, agora))} · ${esc(rotulo(RESULTADOS, v.nucleo.resultado) || 'sem resultado')}${v.checkout ? '' : ' · <b>aberta</b>'}</a>`).join('') || '<p class="sutil">Nenhuma ainda.</p>'}</div>`;

  main.querySelectorAll('.chips').forEach((g) => g.addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    const v = alternarChip(b);
    if (v == null) { alternarChip(b); return; } // estes dois grupos sempre têm um valor
    store.atualizarPonto(p.id, { [g.dataset.campo]: v });
    if (g.dataset.campo === 'status_dia') renderPonto({ main, barra, store, ir }, id);
  }));

  if (aberta && aberta.ponto_id === p.id) {
    barra.innerHTML = `<a class="btn primaria grande" href="#/visita/${aberta.id}">Continuar visita</a>`;
  } else if (aberta) {
    barra.innerHTML = `<a class="btn grande" href="#/visita/${aberta.id}">Há visita aberta em outro ponto</a>`;
  } else {
    barra.innerHTML = `<button class="btn primaria grande" data-acao="checkin">Check-in</button>`;
    barra.onclick = (ev) => {
      if (!ev.target.closest('[data-acao="checkin"]')) return;
      try { const v = store.checkin(p.id); ir(`#/visita/${v.id}`); } catch (e) { toast(e.message); }
    };
  }
}
