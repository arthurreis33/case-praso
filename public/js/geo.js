// GPS. Nunca bloqueia o fluxo: quem chama grava o registro primeiro e preenche a posição quando chegar.
// GPS funciona sem rede (o modo avião desliga o GPS em alguns aparelhos; nesse caso grava o erro).

const ERROS = { 1: 'permissão negada', 2: 'posição indisponível', 3: 'tempo esgotado' };

export function obterPosicao({ timeout = 20000, maximumAge = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('navegador sem GPS'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), precisao_m: p.coords.accuracy }),
      (e) => reject(new Error(ERROS[e.code] || e.message || 'falhou')),
      { enableHighAccuracy: true, timeout, maximumAge },
    );
  });
}
