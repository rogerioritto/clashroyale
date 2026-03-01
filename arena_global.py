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

# Limite de jogadores para amostragem por localizacao
MAX_JOGADORES_POR_LOCATION = 50
# Localizacoes para coletar (global + algumas regioes grandes)
LOCATIONS = ["global", "57000032", "57000038", "57000056"]  # Global, BR, US, EU


def fazer_request(url, tentativas=2):
    """Faz request com retry e tratamento de rate limit."""
    headers = {"Authorization": f"Bearer {TOKEN}"}
    for i in range(tentativas):
        try:
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                print(f"Rate limit, aguardando 5s... ({url})")
                time.sleep(5)
                continue
            else:
                print(f"Erro {response.status_code}: {url}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"Erro de conexao: {e}")
            if i < tentativas - 1:
                time.sleep(2)
    return None


def coletar_jogadores_ranking():
    """Coleta jogadores do ranking de diversas localizacoes."""
    jogadores = {}

    for loc in LOCATIONS:
        if loc == "global":
            url = f"{API_BASE}/locations/global/rankings/players?limit={MAX_JOGADORES_POR_LOCATION}"
        else:
            url = f"{API_BASE}/locations/{loc}/rankings/players?limit={MAX_JOGADORES_POR_LOCATION}"

        data = fazer_request(url)
        if data and 'items' in data:
            for p in data['items']:
                tag = p['tag']
                if tag not in jogadores:
                    jogadores[tag] = {
                        'tag': tag,
                        'trofeus': p.get('trophies', 0),
                        'nome': p.get('name', '')
                    }
            print(f"Location {loc}: {len(data['items'])} jogadores coletados")
        else:
            print(f"Location {loc}: sem dados")

        time.sleep(0.5)

    return list(jogadores.values())


def coletar_batalhas_jogador(tag):
    """Coleta as batalhas recentes de um jogador."""
    tag_encoded = tag.replace('#', '%23')
    url = f"{API_BASE}/players/{tag_encoded}/battlelog"
    return fazer_request(url)


def classificar_faixa(trofeus):
    """Retorna a faixa de trofeus correspondente."""
    for faixa in FAIXAS_TROFEUS:
        if faixa['min'] <= trofeus <= faixa['max']:
            return faixa['nome']
    return None


def processar_batalhas(batalhas, faixa_nome):
    """Processa batalhas e retorna estatisticas de cartas."""
    cartas_stats = defaultdict(lambda: {'total': 0, 'vitorias': 0, 'icone': ''})

    for b in batalhas:
        # Apenas batalhas ladder
        tipo = b.get('type', '')
        if tipo not in ('PvP', 'pathOfLegend'):
            continue

        jogador = b['team'][0]
        oponente = b['opponent'][0]

        if 'startingTrophies' not in jogador:
            continue

        trofeus = jogador['startingTrophies']
        faixa = classificar_faixa(trofeus)
        if faixa != faixa_nome:
            continue

        crowns_j = jogador['crowns']
        crowns_o = oponente['crowns']
        vitoria = crowns_j > crowns_o

        # Cartas do jogador
        for c in jogador.get('cards', []):
            nome = c['name']
            cartas_stats[nome]['total'] += 1
            if vitoria:
                cartas_stats[nome]['vitorias'] += 1
            if not cartas_stats[nome]['icone']:
                cartas_stats[nome]['icone'] = c.get('iconUrls', {}).get('medium', '')

        # Cartas do oponente
        for c in oponente.get('cards', []):
            nome = c['name']
            cartas_stats[nome]['total'] += 1
            if not vitoria:
                cartas_stats[nome]['vitorias'] += 1
            if not cartas_stats[nome]['icone']:
                cartas_stats[nome]['icone'] = c.get('iconUrls', {}).get('medium', '')

    return cartas_stats


def main():
    if not TOKEN:
        print("ERRO: Token nao definido. Configure a variavel de ambiente CLASH_TOKEN.")
        sys.exit(1)

    print("=== Coleta de Dados Globais por Arena ===")

    # 1. Coletar jogadores dos rankings
    print("\n1. Coletando jogadores dos rankings...")
    jogadores = coletar_jogadores_ranking()
    print(f"Total de jogadores unicos: {len(jogadores)}")

    if not jogadores:
        print("Nenhum jogador encontrado. Abortando.")
        sys.exit(1)

    # 2. Coletar batalhas de cada jogador
    print("\n2. Coletando batalhas...")
    todas_batalhas = []
    coletados = 0
    max_coletar = min(len(jogadores), 80)  # Limitar para nao exceder rate limit

    for j in jogadores[:max_coletar]:
        batalhas = coletar_batalhas_jogador(j['tag'])
        if batalhas:
            todas_batalhas.extend(batalhas)
            coletados += 1
            if coletados % 10 == 0:
                print(f"  {coletados}/{max_coletar} jogadores processados ({len(todas_batalhas)} batalhas)")
        time.sleep(0.3)

    print(f"Total de batalhas coletadas: {len(todas_batalhas)}")

    # 3. Processar estatisticas por faixa
    print("\n3. Processando estatisticas por faixa de trofeus...")
    resultado = []

    for faixa in FAIXAS_TROFEUS:
        cartas_stats = defaultdict(lambda: {'total': 0, 'vitorias': 0, 'icone': ''})

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

                for c in p.get('cards', []):
                    nome = c['name']
                    cartas_stats[nome]['total'] += 1
                    if vitoria:
                        cartas_stats[nome]['vitorias'] += 1
                    if not cartas_stats[nome]['icone']:
                        cartas_stats[nome]['icone'] = c.get('iconUrls', {}).get('medium', '')

        # Converter para lista e calcular win rate
        cartas_lista = []
        total_partidas_faixa = 0
        for nome, stats in cartas_stats.items():
            if stats['total'] >= 3:
                wr = round((stats['vitorias'] / stats['total']) * 100, 1) if stats['total'] > 0 else 0
                cartas_lista.append({
                    'nome': nome,
                    'icone': stats['icone'],
                    'uso': stats['total'],
                    'vitorias': stats['vitorias'],
                    'winRate': wr
                })
                total_partidas_faixa = max(total_partidas_faixa, stats['total'])

        # Ordenar por uso (mais usadas primeiro)
        cartas_lista.sort(key=lambda x: x['uso'], reverse=True)

        # Calcular total de partidas na faixa (estimativa)
        partidas_estimadas = sum(1 for b in todas_batalhas
                                  if b.get('type', '') in ('PvP', 'pathOfLegend')
                                  and 'startingTrophies' in b['team'][0]
                                  and faixa['min'] <= b['team'][0]['startingTrophies'] <= faixa['max'])

        resultado.append({
            'faixa': faixa['nome'],
            'min_trofeus': faixa['min'],
            'max_trofeus': faixa['max'],
            'total_partidas': partidas_estimadas,
            'cartas': cartas_lista[:30]  # Top 30 cartas
        })

        print(f"  {faixa['nome']}: {len(cartas_lista)} cartas, ~{partidas_estimadas} partidas")

    # 4. Salvar resultado
    with open(NOME_ARQUIVO_GLOBAL, 'w', encoding='utf-8') as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)

    print(f"\nDados globais salvos em {NOME_ARQUIVO_GLOBAL}!")


if __name__ == "__main__":
    main()
