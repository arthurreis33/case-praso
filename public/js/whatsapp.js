// Mensagens prontas e cesta de entrada (seção 6.8).
// Deep link https://wa.me/?text=… SEM número: o repositório não guarda telefone. O vendedor escolhe
// o contato no próprio WhatsApp. Ao tocar, a plataforma grava um Contato sozinha.
import { CESTA_ENTRADA, PRODUTO } from './demo/catalogo.js';
import { resumoCompras } from './historico.js';
import { nomeDe } from './store.js';
import { dinheiro } from './ui.js';

export const MODELOS = [
  ['recompra', 'Recompra (repetir o último pedido)'],
  ['lembrete_1a_compra', 'Lembrete de 1ª compra'],
  ['reconquista', 'Reconquista'],
];

// Condições como estão em praso.com.br (06/10/2026): sem pedido mínimo, frete grátis para CNPJ e entrega no dia
// seguinte de segunda a sábado (RM do Recife). Pedido de sábado depois das 19h chega na segunda.
export const CONDICOES = 'Sem pedido mínimo e frete grátis para CNPJ. Pedido até as 19h chega no dia seguinte, de segunda a sábado.';

export function cesta(tipo) {
  const c = CESTA_ENTRADA[tipo] || CESTA_ENTRADA.outro;
  const itens = c.skus.map((s) => PRODUTO[s]).filter(Boolean);
  return { ...c, itens, total: itens.reduce((s, i) => s + i.preco, 0) };
}

/** Modelo indicado para o estado do ponto. */
export function modeloPara(estado) {
  if (estado === 'churn') return 'reconquista';
  if (['ativacao', 'recorrente', 'ativacao_vencida'].includes(estado)) return 'recompra';
  return 'lembrete_1a_compra';
}

export function textoMensagem(store, p, modelo) {
  const nome = nomeDe(p);
  const pedidos = store.pedidosDo(p.id);
  if (modelo === 'recompra') {
    const ult = pedidos[0];
    if (!ult) return textoMensagem(store, p, 'lembrete_1a_compra');
    const itens = (ult.itens || []).slice(0, 5).map((i) => `• ${i.qtd}× ${i.nome}`).join('\n');
    return `Olá, pessoal do ${nome}! Aqui é da Praso. Quer repetir o último pedido?\n\n${itens}\n\nÚltima vez deu ${dinheiro(ult.valor)}. É só abrir o app e tocar em "repetir pedido". ${CONDICOES}`;
  }
  if (modelo === 'reconquista') {
    const r = resumoCompras(pedidos);
    const cat = r?.top_categorias?.[0]?.rotulo;
    return `Olá, pessoal do ${nome}! Aqui é da Praso. Faz um tempo que vocês não pedem com a gente${cat ? ` e ${cat.toLowerCase()} era o que mais saía` : ''}. O que aconteceu? Se teve algum problema, quero resolver. ${CONDICOES}`;
  }
  const c = cesta(p.tipo);
  const itens = c.itens.slice(0, 4).map((i) => `• ${i.nome}`).join('\n');
  return `Olá, pessoal do ${nome}! Aqui é da Praso. O cadastro de vocês já está pronto no app. Para começar, uma sugestão de ${c.titulo.toLowerCase()}:\n\n${itens}\n\n${CONDICOES}`;
}

export const linkWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

/** Abre o WhatsApp e grava o Contato. O vendedor não registra nada. */
export function enviarWhatsApp(store, p, modelo) {
  const texto = textoMensagem(store, p, modelo);
  store.registrarContato(p.id, { canal: 'whatsapp', modelo_mensagem: modelo, gerado_pela_plataforma: true });
  window.open(linkWhatsApp(texto), '_blank', 'noopener');
}

export function cestaHtml(tipo, esc, { demo = false } = {}) {
  const c = cesta(tipo);
  return `<div class="caixa"><h3>Cesta de entrada · ${esc(c.titulo)}</h3>
    <p class="sutil">Entre por uma necessidade só, não pela loja toda. Por quê: ${esc(c.porque)}.</p>
    <ul style="margin:6px 0;padding-left:20px">${c.itens.map((i) => `<li>${esc(i.nome)} · <span class="num">${dinheiro(i.preco)}</span></li>`).join('')}</ul>
    <p class="sutil">Total de referência: <b class="num">${dinheiro(c.total)}</b>${demo ? ' (preços de exemplo)' : ''}. Confira o preço do dia no app.</p></div>`;
}
