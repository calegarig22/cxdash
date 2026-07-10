"""Slack integration via Incoming Webhook."""
import requests

from core import db


def webhook_url():
    return db.get_config("slack_webhook", "").strip()


def enviar_slack(texto, contexto=""):
    """Envia mensagem ao Slack. Retorna (ok: bool, detalhe: str).

    Nunca lança exceção — falha de integração não deve quebrar o fluxo.
    """
    url = webhook_url()
    if not url:
        return False, "Webhook do Slack não configurado (Painel Admin)."
    try:
        payload = {"text": texto}
        resp = requests.post(url, json=payload, timeout=8)
        ok = resp.status_code == 200
        db.log_action("sistema", "slack", f"{'OK' if ok else 'FALHA'} | {contexto} | {texto[:120]}")
        return ok, f"HTTP {resp.status_code}"
    except Exception as e:  # noqa: BLE001
        db.log_action("sistema", "slack", f"ERRO | {contexto} | {e}")
        return False, str(e)
