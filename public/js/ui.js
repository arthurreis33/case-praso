// Utilitários de interface: escape, chips, formatação de hora, toast, selos.
import { ESTADOS, FAIXAS, DIAS, QUEM_DECIDE, rotulo } from './catalogo.js';

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

/** Google entra só como deep link de navegação (seção 6.4). Usa a coordenada confirmada, se houver. */
export function mapsUrl(p) {
  const c = p.coord_confirmada || p.coord_cadastral || (p.lat != null ? { lat: p.lat, lng: p.lng } : null);
  const dest = c ? `${c.lat},${c.lng}` : p.endereco_cadastral || p.endereco || p.nome_fantasia || p.nome;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
}

/** Rota com várias paradas (Google aceita até 9 waypoints no link; o resto vai em links seguintes). */
export function mapsRotaUrl(paradas, origem = null) {
  const c = (p) => { const x = p.coord_confirmada || p.coord_cadastral; return x ? `${x.lat},${x.lng}` : null; };
  const pts = paradas.map(c).filter(Boolean).slice(0, 10);
  if (!pts.length) return null;
  const destino = pts.at(-1);
  const meio = pts.slice(0, -1);
  const u = new URL('https://www.google.com/maps/dir/');
  u.searchParams.set('api', '1');
  if (origem) u.searchParams.set('origin', `${origem.lat},${origem.lng}`);
  u.searchParams.set('destination', destino);
  if (meio.length) u.searchParams.set('waypoints', meio.join('|'));
  u.searchParams.set('travelmode', 'driving');
  return u.toString();
}

// ---------------- V2 ----------------

const LETRA = { lead: 'L', cadastrado_sem_compra: 'O', ativacao: 'A', recorrente: 'R', ativacao_vencida: 'V', churn: 'C' };
export const letraEstado = (e) => LETRA[e] || '?';
export const rotuloEstado = (e) => rotulo(ESTADOS, e);

/** Selo de estado: cor + letra + rótulo (nada depende só de cor). */
export function seloEstado(e) {
  return `<span class="selo-estado e-${esc(e)}"><i aria-hidden="true">${letraEstado(e)}</i>${esc(rotuloEstado(e))}</span>`;
}

export function seloPontos(n, { esperados = false } = {}) {
  const t = String(Math.round(n * 100) / 100).replace('.', ',');
  return esperados
    ? `<span class="pontos esperados" title="pontos esperados hoje">≈${t} pt</span>`
    : `<span class="pontos" title="pontos de aquisição">${t} pt</span>`;
}

/** "Dono · 14h–17h · seg a sex" */
export function janelaTexto(decisor, { comPapel = true } = {}) {
  if (!decisor) return '';
  const partes = [];
  if (comPapel && decisor.papel) partes.push(rotulo(QUEM_DECIDE, decisor.papel));
  const j = decisor.janela || {};
  if (j.faixas?.length) partes.push(j.faixas.map((f) => rotulo(FAIXAS, f)).join(', '));
  if (j.dias?.length) partes.push(diasTexto(j.dias));
  return partes.join(' · ');
}

export function diasTexto(dias) {
  const s = new Set((dias || []).map(String));
  if (['1', '2', '3', '4', '5'].every((d) => s.has(d)) && s.size === 5) return 'seg a sex';
  if (['1', '2', '3', '4', '5', '6'].every((d) => s.has(d)) && s.size === 6) return 'seg a sáb';
  return DIAS.filter(([v]) => s.has(v)).map(([, r]) => r.toLowerCase()).join(' ');
}

export const dinheiro = (v) => (v == null ? '–' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
export const data = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`; };
export const pct = (x) => (x == null || Number.isNaN(x) ? '–' : `${Math.round(x * 100)}%`);

/** Diálogo de confirmação (usado pela correção manual e pelo pino). Devolve Promise<boolean>. */
export function confirmar(titulo, texto, rotuloSim = 'Confirmar') {
  const dlg = document.getElementById('dlg-confirmar');
  document.getElementById('confirmar-titulo').textContent = titulo;
  document.getElementById('confirmar-texto').textContent = texto;
  document.getElementById('confirmar-sim').textContent = rotuloSim;
  return new Promise((ok) => {
    dlg.addEventListener('close', () => ok(dlg.returnValue === 'sim'), { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
