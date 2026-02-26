import requests
import json
import os
from datetime import datetime

# --- CONFIGURAÇÃO ---
# O script tentará o Token 1, se falhar por IP (403), tenta o Token 2
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
    # URL do Proxy RoyaleAPI (Padrão da Comunidade)
    url = f"https://proxy.royaleapi.dev/v1/players/{TAG_JOGADOR}/battlelog"
    
    for i, token in enumerate(TOKENS):
        if not token:
            print(f"Aviso: CLASH_TOKEN_{i+1} não configurado no GitHub.")
            continue
        
        print(f"--- Testando Token {i+1} ---")
        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                print("Conexão bem-sucedida!")
                processar_dados(response.json())
                return # Sucesso! Para o loop aqui.
                
            elif response.status_code == 403:
                # REVELA O IP: Esta linha é crucial para sabermos qual IP cadastrar
                print(f"Erro 403 no Token {i+1}. Detalhes da API: {response.text}")
                
            else:
                print(f"Erro inesperado no Token {i+1}: {response.status_code}")
                
        except Exception as e:
            print(f"Falha na requisição: {e}")
            
    print("Infelizmente, todos os tokens falharam devido ao bloqueio de IP.")

def processar_dados(novas_batalhas):
    historico_antigo = carregar_historico_existente()
    ids_salvos = {b['battleTime'] for b in historico_antigo}
    
    batalhas_adicionadas = 0
    for b in novas_batalhas:
        if b['battleTime'] not in ids_salvos:
            historico_antigo.append(b)
            batalhas_adicionadas += 1
            
    if batalhas_adicionadas > 0:
        # Ordena por tempo para manter o JSON organizado
        historico_antigo.sort(key=lambda x: x['battleTime'], reverse=True)
        salvar_historico(historico_antigo)
        print(f"Sucesso! {batalhas_adicionadas} novas batalhas gravadas no JSON.")
    else:
        print("Nenhuma batalha nova encontrada no log da Supercell.")

if __name__ == "__main__":
    tentar_atualizar()
