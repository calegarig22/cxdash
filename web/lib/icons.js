/* Ícones SVG de traço (currentColor). Substituem os emojis da interface. */
import { html } from "htm/preact";

const P = {
  dashboard: '<path d="M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z"/>',
  tarefas: '<rect x="3" y="3" width="14" height="14" rx="3"/><path d="M6.5 10.2l2.2 2.2 4.6-4.8"/>',
  cancelamentos: '<circle cx="10" cy="10" r="7"/><path d="M5.4 5.4l9.2 9.2"/>',
  cobranca: '<rect x="2.5" y="5" width="15" height="10" rx="2"/><circle cx="10" cy="10" r="2.1"/><path d="M5 8v4M15 8v4"/>',
  retencao: '<path d="M16 6.5A6 6 0 1 0 16.4 12"/><path d="M16.3 3.2v3.6h-3.6"/>',
  recibos: '<path d="M6 2.6h5.2L15 6.2V17.4H6z"/><path d="M11 2.6v3.8h3.6"/><path d="M8.2 10h4.6M8.2 12.8h4.6"/>',
  consultorias: '<path d="M5.8 3.4c.7 0 1.2.3 1.6 1.4l.7 1.9c.2.6.1 1-.4 1.4l-.9.7c.9 1.7 2 2.8 3.7 3.7l.7-.9c.4-.5.8-.6 1.4-.4l1.9.7c1.1.4 1.4.9 1.4 1.6 0 1.6-1.4 2.6-2.9 2.4C8.2 16.7 3.3 11.8 3.4 6.3 3.2 4.8 4.2 3.4 5.8 3.4z"/>',
  playbooks: '<path d="M5 4.2c0-.7.5-1.2 1.2-1.2H15v12.4H6.2C5.5 15.4 5 15 5 14.2z"/><path d="M15 15.4H6.2c-.7 0-1.2.5-1.2 1.2s.5 1.2 1.2 1.2H15z"/>',
  voc: '<path d="M4 5.2h12v7.2H9.4L6 15.4v-3H4z"/><path d="M7.2 8.5h5.6M7.2 10.4h3.4"/>',
  relatorios: '<path d="M4 17V4"/><path d="M4 17h13"/><path d="M7.5 17V9M11 17V6M14.5 17v-4"/>',
  admin: '<path d="M4 6.5h6M13.5 6.5h2.5M4 13.5h2.5M10 13.5h6"/><circle cx="11.4" cy="6.5" r="1.7"/><circle cx="7.6" cy="13.5" r="1.7"/>',
  logout: '<path d="M8.5 4H4.5v12h4"/><path d="M12.5 13.2l3.2-3.2-3.2-3.2M15.4 10H7.5"/>',
  reset: '<path d="M15.6 7A6 6 0 1 0 16 11.6"/><path d="M15.9 3.4V7h-3.6"/>',
  download: '<path d="M10 3.5v9M6.4 9.2l3.6 3.6 3.6-3.6"/><path d="M4.5 16h11"/>',
  plus: '<path d="M10 4.5v11M4.5 10h11"/>',
  trash: '<path d="M5 6h10M8 6V4.5h4V6M6.2 6l.6 9.5h6.4L13.8 6"/>',
  copy: '<rect x="6.5" y="6.5" width="9" height="9" rx="1.6"/><path d="M4.5 11.5v-6a1 1 0 0 1 1-1h6"/>',
  send: '<path d="M16.5 4.2L3.6 8.9l5.2 2.1 2.1 5.2z"/><path d="M16.5 4.2L8.8 11"/>',
  print: '<path d="M6 7.5V3.5h8v4"/><rect x="3.5" y="7.5" width="13" height="6" rx="1.5"/><path d="M6 12h8v4.5H6z"/>',
  link: '<path d="M8.5 11.5l3-3M7.5 12.8l-1 1a2.4 2.4 0 0 1-3.4-3.4l1.6-1.6a2.4 2.4 0 0 1 3.4 0"/><path d="M12.5 7.2l1-1a2.4 2.4 0 0 1 3.4 3.4l-1.6 1.6a2.4 2.4 0 0 1-3.4 0"/>',
  save: '<path d="M4.5 4.5h9l3 3v8h-12z"/><path d="M7 4.5v3.5h5.5V4.5M7 15.5v-4h6v4"/>',
  signal: '<circle cx="10" cy="14" r="1.6"/><path d="M6.8 10.8a4.5 4.5 0 0 1 6.4 0M4.6 8.6a7.6 7.6 0 0 1 10.8 0"/>',
  importar: '<path d="M10 12.5V3.6M6.4 7.2L10 3.6l3.6 3.6"/><path d="M4.5 12v3.4a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V12"/>',
};

export function Icon(name, cls = "ic") {
  return html`<span class=${cls} aria-hidden="true" dangerouslySetInnerHTML=${{
    __html: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${P[name] || ""}</svg>`,
  }}></span>`;
}
