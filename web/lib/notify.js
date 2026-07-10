/* Dispara alerta no Slack via função serverless (/api/slack).
   Em modo DEMO (sem backend) apenas registra no console — não quebra o fluxo. */
import { store } from "./store.js";

export async function alertarSlack(texto, contexto = "") {
  await store.logAction("sistema", "slack", `${contexto} | ${texto.slice(0, 120)}`);
  if (store.DEMO) { console.log("[slack demo]", contexto, texto); return { ok: false, demo: true }; }
  try {
    const r = await fetch("/api/slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, contexto }),
    });
    return { ok: r.ok };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
