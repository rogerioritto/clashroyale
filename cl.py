import requests
import json
import os
from datetime import datetime

# --- CONFIGURAÇÃO ---
# Pegamos os dois tokens que você criou no GitHub
TOKENS = [os.getenv('CLASH_TOKEN_1'), os.getenv('CLASH_TOKEN_2')]
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

def tentar_atualizar():
    url = f"https://proxy.royaleapi.dev/v1/players/{TAG_JOGADOR}/battlelog"
    
    # O robô vai tentar cada token da lista até um funcionar
    for i, token in enumerate(TOKENS):
        if not token: continue
        
        print(f"Tentando com Token {i+1}...")
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            print("Conexão estabelecida com sucesso!")
            processar_dados(response.json())
            return # Sai da função se deu certo
        elif response.status_code == 403:
            print(f"Token {i+1} barrado pelo IP. Tentando o próximo...")
        else:
            print(f"Erro inesperado no Token {i+1}: {response.status_code}")
            
    print("Infelizmente todos os tokens falharam devido ao IP do Proxy.")

def processar_dados(novas_batalhas):
    historico_antigo = carregar_historico_existente()
    ids_salvos = {b['battleTime'] for b in historico_antigo}
    
    batalhas_adicionadas = 0
    for b in novas_batalhas:
        if b['battleTime'] not in ids_salvos:
            historico_antigo.append(b)
            batalhas_adicionadas += 1
            
    if batalhas_adicionadas > 0:
        historico_antigo.sort(key=lambda x: x['battleTime'], reverse=True)
        salvar_historico(historico_antigo)
        print(f"Sucesso! {batalhas_adicionadas} novas batalhas salvas.")
    else:
        print("Tudo atualizado. Nenhuma batalha nova.")

if __name__ == "__main__":
    tentar_atualizar()
