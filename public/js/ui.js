// Utilitários de interface: escape, chips, formatação de hora, toast.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Grupo de chips ligado a um campo. Single: tocar de novo desmarca. Multi: alterna.
 * `exclusivo`: valor que, se marcado, limpa os demais (ex.: "nenhum").
 */
export function chips(campo, opcoes, valor, { multi = false, exclusivo = null, classe = '' } = {}) {
  const sel = multi ? new Set((valor || []).map(String)) : new Set(valor == null ? [] : [String(valor)]);
  return `<div class="chips ${classe}" data-campo="${esc(campo)}" data-multi="${multi ? 1 : 0}"${exclusivo ? ` data-exclusivo="${esc(exclusivo)}"` : ''} role="group">${
    opcoes.map(([v, r]) => `<button type="button" class="chip" data-v="${esc(v)}" aria-pressed="${sel.has(String(v))}">${esc(r)}</button>`).join('')
  }</div>`;
}

/** Calcula o novo valor do grupo depois do toque em `botao` e atualiza os aria-pressed. */
export function alternarChip(botao) {
  const g = botao.closest('.chips');
  const multi = g.dataset.multi === '1';
  const v = botao.dataset.v;
  const todos = [...g.querySelectorAll('.chip')];
  if (!multi) {
    const ligado = botao.getAttribute('aria-pressed') === 'true';
    todos.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    if (!ligado) botao.setAttribute('aria-pressed', 'true');
    return ligado ? null : v;
  }
  const ex = g.dataset.exclusivo;
  const ligar = botao.getAttribute('aria-pressed') !== 'true';
  botao.setAttribute('aria-pressed', String(ligar));
  if (ligar && ex) {
    todos.forEach((b) => {
      if (b !== botao && (v === ex || b.dataset.v === ex)) b.setAttribute('aria-pressed', 'false');
    });
  }
  return todos.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.v);
}

const z = (n) => String(n).padStart(2, '0');
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const hora = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${z(d.getHours())}:${z(d.getMinutes())}`; };

/** "hoje 14:00", "amanhã 09:00", "qui 08/10 06:00" */
export function quando(iso, agora = new Date()) {
  if (!iso) return '';
  const d = new Date(iso);
  const dia0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - dia0) / 86400000);
  const h = `${z(d.getHours())}:${z(d.getMinutes())}`;
  if (diff === 0) return `hoje ${h}`;
  if (diff === 1) return `amanhã ${h}`;
  if (diff === -1) return `ontem ${h}`;
  return `${DIAS_CURTOS[d.getDay()]} ${z(d.getDate())}/${z(d.getMonth() + 1)} ${h}`;
}

export function duracao(s) {
  if (s == null) return '–';
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${z(s % 60)} s` : `${Math.floor(m / 60)} h ${z(m % 60)} min`;
}

let toastTimer;
export function toast(msg, ms = 2600) {
  let el = document.getElementById('toast');
  if (!el) {
    el = Object.assign(document.createElement('div'), { id: 'toast', role: 'status' });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}

export function mapsUrl(p) {
  const dest = p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : p.endereco || p.nome;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}
