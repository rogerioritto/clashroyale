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

MAX_JOGADORES_POR_LOCATION = 50


def fazer_request(url, tentativas=2):
    """Faz request com retry e tratamento de rate limit."""
    headers = {"Authorization": f"Bearer {TOKEN}"}
    for i in range(tentativas):
        try:
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                print(f"  Rate limit, aguardando 5s... ({url})")
                time.sleep(5)
                continue
            else:
                print(f"  Erro {response.status_code}: {url}")
                if response.status_code != 404:
                    print(f"  Resposta: {response.text[:200]}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"  Erro de conexao: {e}")
            if i < tentativas - 1:
                time.sleep(2)
    return None


def descobrir_locations():
    """Descobre IDs de localizacoes validas via API."""
    print("Descobrindo localizacoes disponiveis...")
    data = fazer_request(f"{API_BASE}/locations?limit=50")
    if not data:
        print("  Falha ao buscar localizacoes.")
        return []

    items = data.get('items', data) if isinstance(data, dict) else data
    if not isinstance(items, list):
        print(f"  Formato inesperado: {type(items)}")
        return []

    # Filtrar apenas paises (isCountry=true) e pegar os maiores
    paises = [loc for loc in items if loc.get('isCountry', False)]
    # Priorizar paises grandes: BR, US, DE, FR, ES, TR, RU, MX, etc.
    paises_prioritarios = ['Brazil', 'United States', 'Germany', 'France',
                           'Spain', 'Turkey', 'Russia', 'Mexico', 'Indonesia']
    selecionados = []
    for nome in paises_prioritarios:
        for p in paises:
            if p.get('name') == nome:
                selecionados.append(p)
                break
        if len(selecionados) >= 5:
            break

    # Se nao encontrou o suficiente, pegar os primeiros
    if len(selecionados) < 3:
        selecionados = paises[:5]

    for loc in selecionados:
        print(f"  Selecionado: {loc['name']} (ID: {loc['id']})")

    return selecionados


def coletar_jogadores_ranking(locations):
    """Coleta jogadores do ranking de diversas localizacoes."""
    jogadores = {}

    for loc in locations:
        loc_id = loc['id']
        loc_nome = loc['name']
        url = f"{API_BASE}/locations/{loc_id}/rankings/players?limit={MAX_JOGADORES_POR_LOCATION}"

        data = fazer_request(url)
        if data:
            items = data.get('items', data) if isinstance(data, dict) else data
            if isinstance(items, list):
                for p in items:
                    tag = p.get('tag', '')
                    if tag and tag not in jogadores:
                        jogadores[tag] = {
                            'tag': tag,
                            'trofeus': p.get('trophies', 0),
                            'nome': p.get('name', '')
                        }
                print(f"  {loc_nome}: {len(items)} jogadores coletados")
            else:
                print(f"  {loc_nome}: formato inesperado")
        else:
            print(f"  {loc_nome}: sem dados")

        time.sleep(0.5)

    return list(jogadores.values())


def coletar_batalhas_jogador(tag):
    """Coleta as batalhas recentes de um jogador."""
    tag_encoded = tag.replace('#', '%23')
    url = f"{API_BASE}/players/{tag_encoded}/battlelog"
    data = fazer_request(url)
    # battlelog retorna lista diretamente
    if isinstance(data, list):
        return data
    elif isinstance(data, dict) and 'items' in data:
        return data['items']
    return data or []


def main():
    if not TOKEN:
        print("ERRO: Token nao definido. Configure a variavel de ambiente CLASH_TOKEN.")
        sys.exit(1)

    print("=== Coleta de Dados Globais por Arena ===")

    # 1. Descobrir localizacoes e coletar jogadores
    print("\n1. Coletando jogadores dos rankings...")
    locations = descobrir_locations()

    if not locations:
        print("Nenhuma localizacao encontrada. Salvando arquivo vazio.")
        salvar_resultado_vazio()
        return

    jogadores = coletar_jogadores_ranking(locations)
    print(f"Total de jogadores unicos: {len(jogadores)}")

    if not jogadores:
        print("Nenhum jogador encontrado. Salvando arquivo vazio.")
        salvar_resultado_vazio()
        return

    # 2. Coletar batalhas de cada jogador
    print("\n2. Coletando batalhas...")
    todas_batalhas = []
    coletados = 0
    erros = 0
    max_coletar = min(len(jogadores), 80)

    for j in jogadores[:max_coletar]:
        batalhas = coletar_batalhas_jogador(j['tag'])
        if batalhas and isinstance(batalhas, list):
            todas_batalhas.extend(batalhas)
            coletados += 1
        else:
            erros += 1
        if (coletados + erros) % 10 == 0:
            print(f"  {coletados + erros}/{max_coletar} processados ({coletados} ok, {erros} erros, {len(todas_batalhas)} batalhas)")
        time.sleep(0.3)

    print(f"Total de batalhas coletadas: {len(todas_batalhas)}")

    if not todas_batalhas:
        print("Nenhuma batalha coletada. Salvando arquivo vazio.")
        salvar_resultado_vazio()
        return

    # 3. Processar estatisticas por faixa
    print("\n3. Processando estatisticas por faixa de trofeus...")
    resultado = processar_por_faixa(todas_batalhas)

    # 4. Salvar resultado
    with open(NOME_ARQUIVO_GLOBAL, 'w', encoding='utf-8') as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)

    print(f"\nDados globais salvos em {NOME_ARQUIVO_GLOBAL}!")


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

        # Converter para lista
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
