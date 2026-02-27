import requests
import json
import os
from datetime import datetime

# --- CONFIGURAÇÃO ---
TOKEN = os.getenv('CLASH_TOKEN') # Nome simples e único
TAG_JOGADOR = "%23PPVL828U" 
NOME_ARQUIVO = "historico.json"
NOME_DADOS_GRAFICO = "dados_grafico.json"

def atualizar_batalhas():
    url = f"https://proxy.royaleapi.dev/v1/players/{TAG_JOGADOR}/battlelog"
    headers = {"Authorization": f"Bearer {TOKEN}"}
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
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
        
        # AGORA GERAMOS OS DADOS PARA O GRÁFICO
        gerar_dados_grafico(historico)
    else:
        print(f"Erro na API: {response.status_code}")

def gerar_dados_grafico(historico):
    dados_simplificados = []
    for b in reversed(historico):
        jogador = b['team'][0]
        oponente = b['opponent'][0]
        # Filtramos apenas partidas que alteram troféus (Ladder)
        if 'startingTrophies' in jogador:
            data_limpa = b['battleTime'].replace('T', ' ').replace('.000Z', '')
            # Determinar resultado comparando crowns
            if jogador['crowns'] > oponente['crowns']:
                resultado = "vitoria"
            else:
                resultado = "derrota"
            # Extrair deck do jogador (nome + ícone)
            deck = [{"nome": c['name'], "icone": c['iconUrls']['medium']} for c in jogador.get('cards', [])]
            # Extrair cartas do oponente (nome + ícone)
            oponente_cartas = [{"nome": c['name'], "icone": c['iconUrls']['medium']} for c in oponente.get('cards', [])]
            dados_simplificados.append({
                "data": data_limpa,
                "trofeus": jogador['startingTrophies'],
                "resultado": resultado,
                "deck": deck,
                "oponente_cartas": oponente_cartas
            })

    salvar_json(NOME_DADOS_GRAFICO, dados_simplificados)
    print("Dados para o gráfico atualizados!")

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
