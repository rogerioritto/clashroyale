# Clash Analytics Dashboard

Dashboard pessoal de análise de desempenho no Clash Royale. Coleta automaticamente o histórico de batalhas via API oficial e apresenta estatísticas, gráficos e inteligência estratégica.

## Como funciona

1. **`cl.py`** consulta a [API do Clash Royale](https://developer.clashroyale.com/) e busca as batalhas recentes do jogador **LuckMaster** (`#PPVL828U`).
2. Batalhas novas são acumuladas em `historico.json` (ordenadas por data, sem duplicatas).
3. Batalhas de Ladder são processadas e salvas em `dados_grafico.json` com: troféus, resultado (vitória/derrota), deck usado e cartas do oponente.
4. **`index.html`** consome `dados_grafico.json` e renderiza o dashboard completo.

## Funcionalidades

### Monitoramento de Progresso

- **Resumo do Dia** — Troféus atuais, vitórias/derrotas nas últimas 24h e delta de troféus do dia. Sempre visível, independente dos filtros.
- **Gráfico de Evolução** — Linha temporal com pontos coloridos (verde = vitória, vermelho = derrota). Tooltips exibem troféus e resultado ao passar o mouse. Filtro de intervalo de datas com [Flatpickr](https://flatpickr.js.org/).
- **Indicadores Dinâmicos** — Total de partidas, vitórias, derrotas e win rate. Sincronizados com o filtro de calendário.

### Inteligência Estratégica

- **Análise de Decks** — Identifica cada variação de deck usada, mostra os ícones das cartas e calcula a win rate individual. O deck mais usado aparece primeiro.
- **Hard Counters** — Lista as 8 cartas que mais aparecem nos decks adversários em partidas perdidas, com frequência percentual.

## Automação

Um **GitHub Actions** workflow (`.github/workflows/main.yml`) roda diariamente à meia-noite (UTC) e pode ser disparado manualmente. Ele:

1. Executa `cl.py` com o token da API armazenado em `secrets.CLASH_TOKEN`
2. Faz commit e push automático dos JSONs atualizados

## Estrutura

```
├── cl.py                 # Coleta batalhas da API e gera dados enriquecidos
├── index.html            # Dashboard completo (Chart.js + Flatpickr)
├── historico.json         # Histórico bruto de batalhas (gerado automaticamente)
├── dados_grafico.json     # Dados processados para o dashboard (gerado automaticamente)
├── requirements.txt       # Dependência: requests
└── .github/workflows/
    └── main.yml           # GitHub Actions - atualização diária automática
```

## Uso local

```bash
pip install -r requirements.txt
export CLASH_TOKEN="seu_token_aqui"
python cl.py
python -m http.server
```

Acesse `http://localhost:8000` no navegador.
