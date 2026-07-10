/* Recibos — acesso ao gerador oficial da Alumni.
   O embed em iframe dava instabilidade (o navegador trata o gerador como
   terceiro e particiona storage/cookies, quebrando a config salva dele).
   Solução confiável: abrir o gerador na própria aba dele, onde tudo funciona
   — inclusive o envio por e-mail e o histórico "Recibos Gerados". */
import { html } from "htm/preact";
import { store } from "../lib/store.js";

const GERADOR = "https://recibos-alumni.vercel.app/";
const DOCS = [
  "Recibo de pagamento",
  "Termo de quitação",
  "Declaração de vínculo / matrícula",
  "Termo de cancelamento",
  "Comprovante de regularização",
];

export function View({ user }) {
  const abrir = () => store.logAction(user.email, "recibos_abrir", GERADOR);
  return html`
    <h1 class="h1">Recibos</h1>
    <p class="sub">Gerador oficial de recibos e termos da Alumni.</p>

    <div class="rec-hero">
      <div class="rec-eyebrow">Alumni · Documentos oficiais</div>
      <h2 class="rec-title">Gerador de recibos e termos</h2>
      <p class="rec-lead">Preencha, edite e envie os documentos oficiais em PDF.
        O histórico fica no botão <b>Recibos Gerados</b>, no topo do gerador.</p>

      <div class="rec-cta">
        <a class="btn primary lg" href=${GERADOR} target="_blank" rel="noopener" onClick=${abrir}>
          Abrir gerador de recibos →</a>
        <a class="btn lg" href=${GERADOR} target="_blank" rel="noopener" onClick=${abrir}>Recibos gerados</a>
      </div>

      <div class="rec-docs">
        ${DOCS.map((d) => html`<div class="rec-doc"><span class="rec-tick"></span>${d}</div>`)}
      </div>
    </div>`;
}
