import requests
import json
import os
import sys
from datetime import datetime

# --- CONFIGURACAO ---
TOKEN = os.getenv('CLASH_TOKEN')
TAG_JOGADOR = os.getenv('CLASH_TAG') or '%23PPVL828U'
NOME_ARQUIVO = "historico.json"
NOME_DADOS_GRAFICO = "dados_grafico.json"

def atualizar_batalhas():
    # Validar TOKEN antes de chamar a API
    if not TOKEN:
        print("ERRO: Token nao definido. Configure a variavel de ambiente CLASH_TOKEN.")
        sys.exit(1)

    url = f"https://proxy.royaleapi.dev/v1/players/{TAG_JOGADOR}/battlelog"
    headers = {"Authorization": f"Bearer {TOKEN}"}

    try:
        response = requests.get(url, headers=headers, timeout=30)
    except requests.exceptions.ConnectionError:
        print("ERRO: Falha de conexao com a API. Verifique sua internet.")
        sys.exit(1)
    except requests.exceptions.Timeout:
        print("ERRO: Timeout ao conectar com a API.")
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"ERRO: Falha na requisicao: {e}")
        sys.exit(1)

    if response.status_code == 429:
        print("ERRO: Rate limit atingido (429). Aguarde alguns minutos antes de tentar novamente.")
        sys.exit(1)
    elif response.status_code == 403:
        print("ERRO: Token invalido ou expirado (403). Verifique o CLASH_TOKEN.")
        sys.exit(1)
    elif response.status_code == 404:
        print(f"ERRO: Jogador nao encontrado (404). Verifique a tag: {TAG_JOGADOR}")
        sys.exit(1)
    elif response.status_code != 200:
        print(f"ERRO: API retornou status {response.status_code}")
        sys.exit(1)

    novas_batalhas = response.json()
    historico = carregar_json(NOME_ARQUIVO)
    ids_salvos = {b['battleTime'] for b in historico}

    adicionadas = 0
    for b in novas_batalhas:
        if b['battleTime'] not in ids_salvos:
            historico.append(b)
            adicionadas += 1

    if adicionadas > 0:
        historico.sort(key=lambda x: x['battleTime'], reverse=True)
        salvar_json(NOME_ARQUIVO, historico)
        print(f"Sucesso! {adicionadas} novas batalhas.")

    gerar_dados_grafico(historico)

def calcular_elixir_medio(cartas):
    """Calcula o custo medio de elixir de uma lista de cartas."""
    custos = [c.get('elixirCost', 0) for c in cartas]
    if not custos:
        return 0
    return round(sum(custos) / len(custos), 1)

def gerar_dados_grafico(historico):
    dados_simplificados = []
    for b in reversed(historico):
        jogador = b['team'][0]
        oponente = b['opponent'][0]
        if 'startingTrophies' in jogador:
            data_limpa = b['battleTime'].replace('T', ' ').replace('.000Z', '')

            crowns_jogador = jogador['crowns']
            crowns_oponente = oponente['crowns']

            if crowns_jogador > crowns_oponente:
                resultado = "vitoria"
            elif crowns_jogador < crowns_oponente:
                resultado = "derrota"
            else:
                resultado = "empate"

            cartas_jogador = jogador.get('cards', [])
            cartas_oponente = oponente.get('cards', [])

            deck = [{
                "nome": c['name'],
                "icone": c['iconUrls']['medium'],
                "nivel": c.get('level', 0)
            } for c in cartas_jogador]

            oponente_cartas = [{
                "nome": c['name'],
                "icone": c['iconUrls']['medium'],
                "nivel": c.get('level', 0)
            } for c in cartas_oponente]

            trofeus_finais = jogador['startingTrophies'] + jogador.get('trophyChange', 0)

            dados_simplificados.append({
                "data": data_limpa,
                "trofeus": trofeus_finais,
                "resultado": resultado,
                "crowns_jogador": crowns_jogador,
                "crowns_oponente": crowns_oponente,
                "elixir_medio": calcular_elixir_medio(cartas_jogador),
                "elixir_medio_oponente": calcular_elixir_medio(cartas_oponente),
                "deck": deck,
                "oponente_cartas": oponente_cartas
            })

    salvar_json(NOME_DADOS_GRAFICO, dados_simplificados)
    print("Dados para o grafico atualizados!")

def carregar_json(nome):
    if os.path.exists(nome):
        with open(nome, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def salvar_json(nome, dados):
    with open(nome, 'w', encoding='utf-8') as f:
        json.dump(dados, f, indent=4, ensure_ascii=False)

if __name__ == "__main__":
    atualizar_batalhas()
