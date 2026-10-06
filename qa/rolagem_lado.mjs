// Desktop (mouse): a linha de filtros do Mapa rola com a roda e arrastando, e a barra aparece.
// Rode com o app servido em http://localhost:5173 (npm run dev) e o Playwright instalado.
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--hide-scrollbars=false'] }); const ctx = await b.newContext({ viewport: { width: 770, height: 700 } });
const page = await ctx.newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message));
await page.goto('http://localhost:5173/?demo=1#/hoje'); await page.waitForTimeout(1200);
await page.goto('http://localhost:5173/#/mapa'); await page.waitForTimeout(1200);
const linha = page.locator('.chips.rolagem').first();
const info = async () => linha.evaluate((e) => ({ left: Math.round(e.scrollLeft), max: e.scrollWidth - e.clientWidth, barra: e.offsetHeight - e.clientHeight }));
console.log('início', await info());
const bb = await linha.boundingBox();
await page.mouse.move(bb.x + 200, bb.y + 20); await page.mouse.wheel(0, 300); await page.waitForTimeout(200);
console.log('depois da roda', await info());
await page.mouse.move(bb.x + 300, bb.y + 20); await page.mouse.down(); await page.mouse.move(bb.x + 450, bb.y + 20, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(200);
const f = await page.$$eval('[data-f-estado][aria-pressed="true"]', (x) => x.length);
console.log('depois de arrastar', await info(), '| filtro ligado sem querer:', f > 0);
// clique normal ainda liga o filtro
await page.locator('[data-f-estado="churn"]').click(); console.log('clique liga churn:', await page.$eval('[data-f-estado="churn"]', (e) => e.getAttribute('aria-pressed')));
await page.screenshot({ path: 'rolagem.png', clip: { x: 0, y: 50, width: 770, height: 150 } });
console.log('erros', erros); await b.close();
