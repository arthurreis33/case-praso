// Modo demonstração. Fica escondido na navegação normal: o vendedor na rua não vê simulador,
// relógio, selo "fictício" nem os atalhos de "simular".
// Liga com ?demo=1 (no endereço ou depois do #), com 5 toques seguidos na logo, ou em Perfil.
// Desliga com ?demo=0 ou em Perfil. Fica guardado neste aparelho (é conveniência, não dado).
const CHAVE = 'praso_demo';

function lerParametro() {
  try {
    const q = new URLSearchParams(location.search).get('demo');
    const h = new URLSearchParams(location.hash.split('?')[1] || '').get('demo');
    return q ?? h;
  } catch { return null; }
}

function lerGuardado() {
  try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; }
}

let ligado = (() => {
  const p = lerParametro();
  if (p === '1' || p === '0') { guardar(p === '1'); return p === '1'; }
  return lerGuardado();
})();

function guardar(on) {
  try { if (on) localStorage.setItem(CHAVE, '1'); else localStorage.removeItem(CHAVE); } catch { /* sem storage: vale só nesta sessão */ }
}

export const modoDemo = () => ligado;

export function ligarDemo(on) {
  ligado = !!on;
  guardar(ligado);
  if (typeof document !== 'undefined') document.body.classList.toggle('demo', ligado);
  return ligado;
}

/** Cinco toques em até 3 s alternam o modo. Devolve true quando alternou. */
let toques = [];
export function toqueNaMarca(agora = Date.now()) {
  toques = [...toques.filter((t) => agora - t < 3000), agora];
  if (toques.length >= 5) { toques = []; ligarDemo(!ligado); return true; }
  return false;
}
