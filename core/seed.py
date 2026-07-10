"""Popula o banco com usuários padrão e dados de exemplo (apenas 1x)."""
from datetime import date, timedelta

from core import db
from core.auth import hash_senha


def _d(offset):
    return (date.today() + timedelta(days=offset)).strftime("%Y-%m-%d")


def _usuarios():
    if db.query_one("SELECT 1 FROM users LIMIT 1"):
        return
    base = [
        ("Administrador", "admin@betteredu.com.br", "admin123", "Admin"),
        ("Ana CX", "ana.cx@betteredu.com.br", "cx123", "CX"),
        ("Bruno Financeiro", "bruno.fin@betteredu.com.br", "fin123", "Financeiro"),
        ("Carla Coordenação", "carla.coord@betteredu.com.br", "coord123", "Coordenação"),
    ]
    for nome, email, senha, perfil in base:
        salt, h = hash_senha(senha)
        db.execute(
            "INSERT INTO users (nome, email, senha_hash, salt, perfil, ativo, criado_em) "
            "VALUES (?,?,?,?,?,1,?)",
            (nome, email.lower(), h, salt, perfil, db.now()),
        )


def _config():
    if db.get_config("slack_webhook") is None:
        db.set_config("slack_webhook", "")


def _tarefas():
    if db.query_one("SELECT 1 FROM tarefas LIMIT 1"):
        return
    dados = [
        ("Retornar contato do aluno João sobre boleto", "Cobrança", "Ana CX", "Alta", "Em andamento", _d(-1)),
        ("Analisar pedido de cancelamento – Maria", "Cancelamento", "Bruno Financeiro", "Crítica", "Aguardando outra área", _d(-3)),
        ("Ligar para aluno em risco de churn – Pedro", "Retenção", "Carla Coordenação", "Alta", "Aberta", _d(2)),
        ("Emitir recibo de pagamento – Lucas", "Financeiro", "Ana CX", "Média", "Aberta", _d(1)),
        ("Responder Reclame Aqui #4521", "Reclame Aqui", "Ana CX", "Crítica", "Aberta", _d(0)),
        ("Follow-up acadêmico – turma B2", "Acadêmico", "Carla Coordenação", "Baixa", "Concluída", _d(-5)),
    ]
    for titulo, tipo, resp, prio, status, prazo in dados:
        tid = db.execute(
            "INSERT INTO tarefas (titulo,tipo,responsavel,prioridade,status,prazo,observacoes,criado_em,atualizado_em)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            (titulo, tipo, resp, prio, status, prazo, "", db.now(), db.now()),
        )
        db.execute(
            "INSERT INTO tarefa_historico (tarefa_id,ts,usuario,texto) VALUES (?,?,?,?)",
            (tid, db.now(), "sistema", f"Tarefa criada com status '{status}'."),
        )


def _cancelamentos():
    if db.query_one("SELECT 1 FROM cancelamentos LIMIT 1"):
        return
    dados = [
        ("Maria Souza", "maria@email.com", "(11) 99999-1111", _d(-22), "Mudança financeira", "Aguardando financeiro", 300, 150, 800),
        ("Rafael Lima", "rafael@email.com", "(11) 98888-2222", _d(-5), "Insatisfação metodologia", "Em análise", 0, 0, 0),
        ("Julia Alves", "julia@email.com", "(11) 97777-3333", _d(-28), "Falta de tempo", "Aguardando diretoria", 200, 100, 500),
    ]
    for aluno, email, tel, dt, motivo, status, multa, material, reemb in dados:
        cid = db.execute(
            "INSERT INTO cancelamentos (aluno,email,telefone,data_solicitacao,motivo,status,"
            "valor_multa,valor_material,valor_reembolso,observacoes,anexos,criado_em)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (aluno, email, tel, dt, motivo, status, multa, material, reemb, "", "", db.now()),
        )
        db.execute(
            "INSERT INTO cancelamento_historico (cancelamento_id,ts,usuario,texto) VALUES (?,?,?,?)",
            (cid, db.now(), "sistema", f"Solicitação registrada – status '{status}'."),
        )


def _cobrancas():
    if db.query_one("SELECT 1 FROM cobrancas LIMIT 1"):
        return
    dados = [
        ("João Pereira", 450.0, _d(-8), "2º contato", "Ana CX"),
        ("Fernanda Dias", 1200.0, _d(-65), "Pré-negativação", "Bruno Financeiro"),
        ("Carlos Nunes", 300.0, _d(-15), "3º contato", "Ana CX"),
        ("Beatriz Rocha", 890.0, _d(-3), "1º contato", "Bruno Financeiro"),
        ("Diego Martins", 600.0, _d(-30), "Regularizado", "Ana CX"),
    ]
    for aluno, valor, venc, status, resp in dados:
        db.execute(
            "INSERT INTO cobrancas (aluno,valor,vencimento,status,ultima_mensagem,proxima_acao,"
            "responsavel,observacoes,criado_em) VALUES (?,?,?,?,?,?,?,?,?)",
            (aluno, valor, venc, status, "", "", resp, "", db.now()),
        )


def _retencao():
    if db.query_one("SELECT 1 FROM retencao LIMIT 1"):
        return
    dados = [
        ("Pedro Gomes", "financeiro", "alto", "Plano de retomada leve", "Em acompanhamento", "Em acompanhamento"),
        ("Sofia Ramos", "metodologia", "médio", "Reavaliação acadêmica", "Em acompanhamento", "Em acompanhamento"),
        ("Thiago Melo", "baixo uso", "alto", "Aulas particulares", "Em acompanhamento", "Em acompanhamento"),
        ("Lara Costa", "horários", "baixo", "Ajuste de agenda", "Em acompanhamento", "Retido"),
    ]
    from modules.retencao import calcular_score  # import tardio p/ evitar ciclo
    for aluno, motivo, nivel, acao, status, resultado in dados:
        score = calcular_score(motivo, nivel)
        db.execute(
            "INSERT INTO retencao (aluno,motivo,nivel,acao_sugerida,status,resultado,observacoes,score,criado_em)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            (aluno, motivo, nivel, acao, status, resultado, "", score, db.now()),
        )


def _consultorias():
    if db.query_one("SELECT 1 FROM consultorias LIMIT 1"):
        return
    dados = [
        ("Isabela Freitas", "Private", "Ana CX", _d(-2), _d(3), "Carla Coordenação", "Agendada", "https://zoom.us/j/123"),
        ("Marcelo Pinto", "Black", "Bruno Financeiro", _d(-1), "", "Carla Coordenação", "Aprovada", ""),
        ("Renata Lopes", "Retenção", "Carla Coordenação", _d(-10), _d(-4), "Ana CX", "Realizada", "https://zoom.us/j/456"),
    ]
    for aluno, tipo, solic, dsol, dag, resp, status, zoom in dados:
        db.execute(
            "INSERT INTO consultorias (aluno,tipo,solicitante,data_solicitada,data_agendada,"
            "responsavel,status,link_zoom,observacoes,criado_em) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (aluno, tipo, solic, dsol, dag, resp, status, zoom, "", db.now()),
        )


def _playbooks():
    if db.query_one("SELECT 1 FROM playbooks LIMIT 1"):
        return
    dados = [
        ("Cobrança", "1º contato amigável",
         "Olá {nome}! Tudo bem? Identificamos uma pendência referente à sua mensalidade. "
         "Podemos te ajudar a regularizar? Qualquer dúvida, estou à disposição. 💙"),
        ("Cobrança", "Pré-negativação",
         "Olá {nome}, seu débito está há mais de 60 dias em aberto. Para evitar a negativação, "
         "pedimos a regularização até {data}. Podemos negociar condições especiais."),
        ("Cancelamento", "Recebimento da solicitação",
         "Olá {nome}, recebemos sua solicitação de cancelamento. Ela será analisada em até 30 dias "
         "conforme contrato. Retornaremos com os próximos passos."),
        ("Retenção", "Oferta de retenção",
         "{nome}, queremos muito te ajudar a continuar sua evolução! Que tal reavaliarmos juntos "
         "seu plano de estudos e agenda? Temos algumas opções pensadas pra você."),
        ("Aluno agressivo", "Acolhimento e desescalada",
         "Entendo sua frustração, {nome}, e lamento muito pelo ocorrido. Vou tratar isso "
         "pessoalmente e te dar um retorno com prazo definido. Obrigado pela paciência."),
        ("Problemas com plataforma", "Suporte técnico",
         "Sentimos muito pelo transtorno, {nome}. Pode nos enviar um print do erro? "
         "Nossa equipe técnica já está acompanhando e retornaremos rapidamente."),
        ("Reembolso", "Confirmação de reembolso",
         "Olá {nome}, seu reembolso foi aprovado no valor de {valor} e será processado em até "
         "10 dias úteis na forma de pagamento original."),
        ("Reclame Aqui", "Resposta pública padrão",
         "Olá! Lamentamos o ocorrido e já estamos em contato direto para solucionar. "
         "A Alumni preza pela melhor experiência e vamos resolver isso com você."),
    ]
    for cat, tit, cont in dados:
        db.execute(
            "INSERT INTO playbooks (categoria,titulo,conteudo,favorito,criado_em) VALUES (?,?,?,0,?)",
            (cat, tit, cont, db.now()),
        )


def _voc():
    if db.query_one("SELECT 1 FROM voc LIMIT 1"):
        return
    dados = [
        ("Pedro Gomes", "Plataforma", "reclamação", "Alta", "App trava ao abrir aulas", "Produto", "Aberto", ""),
        ("Sofia Ramos", "Professor", "reclamação", "Média", "Professor faltou 2 aulas", "Acadêmico", "Em tratativa", ""),
        ("Isabela Freitas", "Metodologia", "elogio", "Baixa", "Adorei o método de conversação", "Acadêmico", "Resolvido", ""),
        ("Carlos Nunes", "Horário", "sugestão", "Baixa", "Poderia ter turmas noturnas", "Comercial", "Aberto", ""),
        ("Fernanda Dias", "Financeiro", "reclamação", "Crítica", "Cobrança indevida na fatura", "Financeiro", "Aberto", ""),
        ("Rafael Lima", "Plataforma", "reclamação", "Alta", "Vídeos não carregam", "Produto", "Aberto", ""),
    ]
    for aluno, cat, tipo, grav, desc, area, status, acao in dados:
        db.execute(
            "INSERT INTO voc (aluno,categoria,tipo,gravidade,descricao,area,status,acao,criado_em)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            (aluno, cat, tipo, grav, desc, area, status, acao, db.now()),
        )


def seed_all():
    db.init_db()
    _usuarios()
    _config()
    _tarefas()
    _cancelamentos()
    _cobrancas()
    _retencao()
    _consultorias()
    _playbooks()
    _voc()
