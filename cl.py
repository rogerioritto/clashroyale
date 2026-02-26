import requests
import json
import os
from datetime import datetime

# --- CONFIGURAÇÃO ---
TOKEN = os.getenv('CLASH_TOKEN') # Nome simples e único
TAG_JOGADOR = "%23PPVL828U" 
NOME_ARQUIVO = "historico.json"

def carregar_historico_existente():
    if os.path.exists(NOME_ARQUIVO):
        with open(NOME_ARQUIVO, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def salvar_historico(dados):
    with open(NOME_ARQUIVO, 'w', encoding='utf-8') as f:
        json.dump(dados, f, indent=4, ensure_ascii=False)

def atualizar_batalhas():
    if not TOKEN:
        print("ERRO: O segredo 'CLASH_TOKEN' não foi encontrado pelo GitHub.")
        return

    url = f"https://proxy.royaleapi.dev/v1/players/{TAG_JOGADOR}/battlelog"
    headers = {"Authorization": f"Bearer {TOKEN}"}
    
    try:
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            print("Sucesso! Conexão estabelecida.")
            processar_dados(response.json())
        elif response.status_code == 403:
            # ESTA LINHA É A CHAVE: Ela vai nos dizer o IP exato no log
            print(f"Erro 403: IP bloqueado. Resposta da Supercell: {response.text}")
        else:
            print(f"Erro inesperado: {response.status_code}")
            
    except Exception as e:
        print(f"Falha técnica: {e}")

def processar_dados(novas_batalhas):
    historico = carregar_historico_existente()
    ids_salvos = {b['battleTime'] for b in historico}
    adicionadas = 0
    for b in novas_batalhas:
        if b['battleTime'] not in ids_salvos:
            historico.append(b)
            adicionadas += 1
    if adicionadas > 0:
        historico.sort(key=lambda x: x['battleTime'], reverse=True)
        salvar_historico(historico)
        print(f"JSON atualizado com {adicionadas} novas batalhas.")
    else:
        print("Nenhuma batalha nova para adicionar.")

if __name__ == "__main__":
    atualizar_batalhas()
