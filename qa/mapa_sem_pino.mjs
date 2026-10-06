// Regressão de 06/10: o Mapa quebrava ("L.divIcon is not a function") quando havia ponto sem localização.
// Rode com o app servido em http://localhost:5173 (npm run dev) e o Playwright instalado.
import { chromium } from 'playwright';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message));
// 1) carteira vazia
await page.goto('http://localhost:5173/#/mapa'); await page.waitForTimeout(1200);
console.log('vazio:', await page.$eval('#app', (e) => (e.querySelector('.aviso.erro')?.innerText) || 'ok'));
// 2) demo + 2 pontos sem localização
await page.goto('http://localhost:5173/?demo=1#/hoje'); await page.waitForTimeout(1200);
await page.evaluate(() => { const s = window.__store; s.novoPonto({ nome_fantasia: 'Sem pino A', tipo: 'bar', origem: 'campo' }); s.novoPonto({ nome_fantasia: 'Sem pino B', tipo: 'padaria', origem: 'campo', cnpj: '11222333000181' }); });
await page.goto('http://localhost:5173/#/mapa'); await page.waitForTimeout(1500);
console.log('com sem-pino:', await page.$eval('#app', (e) => (e.querySelector('.aviso.erro')?.innerText) || 'ok'), '|', await page.$eval('.sem-pino', (e) => e.innerText).catch(() => 'sem aviso'));
console.log('pinos no mapa:', await page.$$eval('.leaflet-marker-icon', (x) => x.length));
await page.click('.sem-pino a'); await page.waitForTimeout(500);
console.log('carteira filtrada:', await page.$eval('#n-res', (e) => e.innerText), await page.$eval('[data-filtro="sem_pino"]', (e) => e.getAttribute('aria-pressed')));
console.log('erros:', erros); await b.close();
