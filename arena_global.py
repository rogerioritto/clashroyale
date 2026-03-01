import requests
import json
import os
import sys
import time
from collections import defaultdict

# --- CONFIGURACAO ---
TOKEN = os.getenv('CLASH_TOKEN')
NOME_ARQUIVO_GLOBAL = "dados_arena_global.json"
API_BASE = "https://proxy.royaleapi.dev/v1"

# Faixas de trofeus que representam arenas/ligas
FAIXAS_TROFEUS = [
    {"nome": "Arena 15 (Legendary)", "min": 5000, "max": 5499},
    {"nome": "Arena 16 (Champion)", "min": 5500, "max": 5999},
    {"nome": "Arena 17 (Grand Champion)", "min": 6000, "max": 6499},
    {"nome": "Arena 18 (Royal Champion)", "min": 6500, "max": 6999},
    {"nome": "Arena 19 (Ultimate Champion)", "min": 7000, "max": 7999},
    {"nome": "Arena 20+ (Top Ladder)", "min": 8000, "max": 99999},
]


def fazer_request(url, tentativas=2):
    """Faz request com retry e tratamento de rate limit."""
    headers = {"Authorization": f"Bearer {TOKEN}"}
    for i in range(tentativas):
        try:
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                print(f"  Rate limit, aguardando 10s...")
                time.sleep(10)
                continue
            elif response.status_code == 503:
                print(f"  API indisponivel (503), aguardando 5s...")
                time.sleep(5)
                continue
            else:
                return None
        except requests.exceptions.RequestException as e:
            print(f"  Erro de conexao: {e}")
            if i < tentativas - 1:
                time.sleep(2)
    return None


def buscar_clas(min_score=30000, limit=10, name=None):
    """Busca clas ativos com pontuacao minima ou por nome."""
    params = f"minMembers=15&limit={limit}"
    if name:
        params += f"&name={name}"
    else:
        params += f"&minScore={min_score}"
    url = f"{API_BASE}/clans?{params}"
    data = fazer_request(url)
    if data and 'items' in data:
        return data['items']
    elif isinstance(data, list):
        return data
    return []


def buscar_membros_cla(cla_tag):
    """Busca membros de um cla."""
    tag_encoded = cla_tag.replace('#', '%23')
    url = f"{API_BASE}/clans/{tag_encoded}/members"
    data = fazer_request(url)
    if data and 'items' in data:
        return data['items']
    elif isinstance(data, list):
        return data
    return []


def buscar_battlelog(tag):
    """Busca as batalhas recentes de um jogador."""
    tag_encoded = tag.replace('#', '%23')
    url = f"{API_BASE}/players/{tag_encoded}/battlelog"
    data = fazer_request(url)
    if isinstance(data, list):
        return data
    elif isinstance(data, dict) and 'items' in data:
        return data['items']
    return []


def main():
    if not TOKEN:
        print("ERRO: Token nao definido.")
        sys.exit(1)

    print("=== Coleta de Dados Globais por Arena ===")

    # 1. Buscar clas variados para cobrir diferentes faixas de trofeus
    print("\n1. Buscando clas variados...")
    # Buscar por nomes comuns para encontrar clas de diferentes niveis
    termos_busca = ["brasil", "team", "clan", "warriors", "kings",
                    "dragon", "fire", "dark", "legend", "royal"]
    clas = []
    tags_ja_adicionados = set()

    # Primeiro buscar clas de topo
    resultado_clas = buscar_clas(min_score=40000, limit=5)
    for c in resultado_clas:
        tag = c.get('tag', '')
        if tag not in tags_ja_adicionados:
            clas.append(c)
            tags_ja_adicionados.add(tag)
    print(f"  Top clas: {len(resultado_clas)} encontrados")
    time.sleep(0.3)

    # Depois buscar por nomes para variedade
    for termo in termos_busca:
        resultado_clas = buscar_clas(name=termo, limit=5)
        novos = 0
        for c in resultado_clas:
            tag = c.get('tag', '')
            if tag not in tags_ja_adicionados:
                clas.append(c)
                tags_ja_adicionados.add(tag)
                novos += 1
        if novos > 0:
            print(f"  Busca '{termo}': {novos} novos clas")
        time.sleep(0.3)
        if len(clas) >= 20:
            break

    print(f"  Total: {len(clas)} clas unicos")

    if not clas:
        print("Nenhum cla encontrado. Salvando arquivo vazio.")
        salvar_resultado_vazio()
        return

    # 2. Coletar membros dos clas
    print("\n2. Coletando membros dos clas...")
    jogadores = {}
    for cla in clas:
        cla_tag = cla.get('tag', '')
        cla_nome = cla.get('name', '?')
        membros = buscar_membros_cla(cla_tag)
        for m in membros:
            tag = m.get('tag', '')
            trofeus = m.get('trophies', 0)
            if tag and tag not in jogadores and trofeus >= 4000:
                jogadores[tag] = {
                    'tag': tag,
                    'trofeus': trofeus,
                    'nome': m.get('name', '')
                }
        print(f"  {cla_nome}: {len(membros)} membros")
        time.sleep(0.3)

    print(f"  Total jogadores unicos (5000+ trofeus): {len(jogadores)}")

    if not jogadores:
        print("Nenhum jogador encontrado. Salvando arquivo vazio.")
        salvar_resultado_vazio()
        return

    # 3. Coletar batalhas dos jogadores (amostra)
    print("\n3. Coletando batalhas...")
    jogadores_lista = list(jogadores.values())
    max_coletar = min(len(jogadores_lista), 60)
    todas_batalhas = []
    coletados = 0

    for j in jogadores_lista[:max_coletar]:
        batalhas = buscar_battlelog(j['tag'])
        if batalhas:
            todas_batalhas.extend(batalhas)
            coletados += 1
        if (coletados) % 10 == 0 and coletados > 0:
            print(f"  {coletados}/{max_coletar} jogadores ok ({len(todas_batalhas)} batalhas)")
        time.sleep(0.3)

    print(f"  Total: {coletados} jogadores, {len(todas_batalhas)} batalhas")

    if not todas_batalhas:
        print("Nenhuma batalha coletada. Salvando arquivo vazio.")
        salvar_resultado_vazio()
        return

    # 4. Processar estatisticas por faixa
    print("\n4. Processando estatisticas...")
    resultado = processar_por_faixa(todas_batalhas)

    # 5. Salvar resultado
    with open(NOME_ARQUIVO_GLOBAL, 'w', encoding='utf-8') as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)

    total_com_dados = sum(1 for r in resultado if r['total_partidas'] > 0)
    print(f"\nDados salvos! {total_com_dados}/{len(FAIXAS_TROFEUS)} faixas com dados.")


def processar_por_faixa(todas_batalhas):
    """Processa batalhas e gera estatisticas por faixa de trofeus."""
    resultado = []

    for faixa in FAIXAS_TROFEUS:
        cartas_stats = defaultdict(lambda: {'total': 0, 'vitorias': 0, 'icone': ''})
        partidas_na_faixa = 0

        for b in todas_batalhas:
            tipo = b.get('type', '')
            if tipo not in ('PvP', 'pathOfLegend'):
                continue

            for lado in ['team', 'opponent']:
                p = b[lado][0]
                if 'startingTrophies' not in p:
                    continue

                trofeus = p['startingTrophies']
                if not (faixa['min'] <= trofeus <= faixa['max']):
                    continue

                outro_lado = 'opponent' if lado == 'team' else 'team'
                outro = b[outro_lado][0]

                crowns_p = p['crowns']
                crowns_o = outro['crowns']
                vitoria = crowns_p > crowns_o

                partidas_na_faixa += 1

                for c in p.get('cards', []):
                    nome = c['name']
                    cartas_stats[nome]['total'] += 1
                    if vitoria:
                        cartas_stats[nome]['vitorias'] += 1
                    if not cartas_stats[nome]['icone']:
                        cartas_stats[nome]['icone'] = c.get('iconUrls', {}).get('medium', '')

        cartas_lista = []
        for nome, stats in cartas_stats.items():
            if stats['total'] >= 3:
                wr = round((stats['vitorias'] / stats['total']) * 100, 1)
                cartas_lista.append({
                    'nome': nome,
                    'icone': stats['icone'],
                    'uso': stats['total'],
                    'vitorias': stats['vitorias'],
                    'winRate': wr
                })

        cartas_lista.sort(key=lambda x: x['uso'], reverse=True)

        resultado.append({
            'faixa': faixa['nome'],
            'min_trofeus': faixa['min'],
            'max_trofeus': faixa['max'],
            'total_partidas': partidas_na_faixa,
            'cartas': cartas_lista[:30]
        })

        print(f"  {faixa['nome']}: {len(cartas_lista)} cartas, {partidas_na_faixa} partidas")

    return resultado


def salvar_resultado_vazio():
    """Salva um arquivo vazio para nao quebrar o frontend."""
    resultado = [{
        'faixa': f['nome'],
        'min_trofeus': f['min'],
        'max_trofeus': f['max'],
        'total_partidas': 0,
        'cartas': []
    } for f in FAIXAS_TROFEUS]

    with open(NOME_ARQUIVO_GLOBAL, 'w', encoding='utf-8') as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)
    print(f"Arquivo vazio salvo em {NOME_ARQUIVO_GLOBAL}")


if __name__ == "__main__":
    main()
