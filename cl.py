import requests
from datetime import datetime
import json
import os

# --- CONFIGURAÇÃO ---
TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjhhYmQ5M2JhLTIxNDgtNDdhNC1iNTFiLTQ0Mzg1MTJlNzcxZCIsImlhdCI6MTc3MjExMjEwMywic3ViIjoiZGV2ZWxvcGVyL2QxNGM1YzEzLTA2NTYtNDRmNi0wNDM3LTk2ZDBmYjg2MDdkZCIsInNjb3BlcyI6WyJyb3lhbGUiXSwibGltaXRzIjpbeyJ0aWVyIjoiZGV2ZWxvcGVyL3NpbHZlciIsInR5cGUiOiJ0aHJvdHRsaW5nIn0seyJjaWRycyI6WyIxOTEuNTcuMi4yMjYiXSwidHlwZSI6ImNsaWVudCJ9XX0.ofvwmebApc8PqLtaN3mMcSNQEGeSM_SGIxcKsF7VECSVhCiKAbkfTIbKHKh6j9Nf2SV4tywxNd6A_1uQkuzO0Q"
TAG_JOGADOR = "%23PPVL828U"
NOME_ARQUIVO = "historico.json"

headers = {"Authorization": f"Bearer {TOKEN}"}

def carregar_historico_existente():
    """Lê o arquivo JSON se ele existir, caso contrário retorna uma lista vazia."""
    if os.path.exists(NOME_ARQUIVO):
        with open(NOME_ARQUIVO, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def salvar_historico(dados):
    """Salva a lista completa de batalhas no arquivo JSON."""
    with open(NOME_ARQUIVO, 'w', encoding='utf-8') as f:
        json.dump(dados, f, indent=4, ensure_ascii=False)

def atualizar_batalhas():
    url = f"https://api.clashroyale.com/v1/players/{TAG_JOGADOR}/battlelog"
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        novas_batalhas = response.json()
        historico_antigo = carregar_historico_existente()
        
        # Criamos um conjunto (set) de IDs de batalhas já salvas para busca rápida
        ids_salvos = {b['battleTime'] for b in historico_antigo}
        
        batalhas_adicionadas = 0
        for b in novas_batalhas:
            # Só adicionamos se o battleTime não estiver nos IDs já salvos
            if b['battleTime'] not in ids_salvos:
                historico_antigo.append(b)
                batalhas_adicionadas += 1
        
        if batalhas_adicionadas > 0:
            # Ordena por data (mais recente primeiro) antes de salvar
            historico_antigo.sort(key=lambda x: x['battleTime'], reverse=True)
            salvar_historico(historico_antigo)
            print(f"Sucesso! {batalhas_adicionadas} novas batalhas adicionadas.")
        else:
            print("Nenhuma batalha nova encontrada desde a última execução.")
            
    else:
        print(f"Erro ao acessar API: {response.status_code}")

# Executa o processo
atualizar_batalhas()