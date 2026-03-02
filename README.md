# Clash Analytics Dashboard

Dashboard pessoal de analise de desempenho no Clash Royale. Coleta automaticamente o historico de batalhas via API oficial e apresenta estatisticas, graficos e inteligencia estrategica.

## Como funciona

1. **`cl.py`** consulta a [API do Clash Royale](https://developer.clashroyale.com/) e busca as batalhas recentes do jogador **LuckMaster** (`#PPVL828U`).
2. Batalhas novas sao acumuladas em `historico.json` (ordenadas por data, sem duplicatas).
3. Batalhas de Ladder sao processadas e salvas em `dados_grafico.json` com: trofeus, resultado (vitoria/derrota), deck usado e cartas do oponente.
4. **`arena_global.py`** coleta dados de jogadores de diferentes faixas de trofeus para gerar estatisticas globais por arena, salvando em `dados_arena_global.json`.
5. **`index.html`** consome os JSONs e renderiza o dashboard completo com `app.js` e `styles.css`.

## Funcionalidades

### Monitoramento de Progresso

- **Resumo do Dia** — Trofeus atuais, vitorias/derrotas nas ultimas 24h e delta de trofeus do dia. Sempre visivel, independente dos filtros.
- **Grafico de Evolucao** — Linha temporal com pontos coloridos (verde = vitoria, vermelho = derrota). Tooltips exibem trofeus e resultado ao passar o mouse.
- **Filtros de Periodo** — Filtros rapidos (Hoje, 7 dias, 30 dias, Este mes) e seletor de intervalo com [Flatpickr](https://flatpickr.js.org/).
- **Indicadores Dinamicos** — Total de partidas, vitorias, derrotas, empates e win rate. Sincronizados com o filtro de periodo.

### Inteligencia Estrategica

- **Analise de Decks** — Identifica cada variacao de deck usada, mostra os icones das cartas e calcula a win rate individual. O deck mais usado aparece primeiro.
- **Hard Counters** — Lista as 8 cartas que mais aparecem nos decks adversarios em partidas perdidas, com frequencia percentual.
- **Cartas Favoraveis** — Lista as 8 cartas mais frequentes nos decks adversarios em partidas vencidas.
- **Win Rate por Carta Adversaria** — Mostra o win rate contra cada carta adversaria (minimo 3 aparicoes), ordenado do pior ao melhor.
- **Matchup por Arquetipo** — Detecta arquetipos adversarios (Golem Beatdown, Hog Cycle, Logbait, etc.) e calcula o win rate contra cada um.

### Meta Global por Arena

- **Analise Global por Arena** — Mostra as cartas mais usadas e maiores/piores win rates em cada faixa de trofeus (Arena 15 a Top Ladder).
- Auto-seleciona a arena do jogador (ou a mais proxima com dados disponiveis).

### Historico de Partidas

- **Tabela paginada** com data, resultado, trofeus, deck, crowns e deck do oponente.
- **Ordenacao** por data, resultado ou trofeus.

## Automacao

Um **GitHub Actions** workflow (`.github/workflows/main.yml`) roda diariamente a meia-noite (UTC) e pode ser disparado manualmente. Ele:

1. Executa `cl.py` com o token da API armazenado em `secrets.CLASH_TOKEN`
2. Faz commit e push automatico dos JSONs atualizados

## Estrutura

```
├── cl.py                     # Coleta batalhas da API e gera dados processados
├── arena_global.py           # Coleta dados globais por arena de diferentes faixas
├── index.html                # Pagina principal do dashboard
├── app.js                    # Logica do dashboard (graficos, filtros, analises)
├── styles.css                # Estilos e temas (dark/light)
├── sw.js                     # Service Worker para cache offline
├── historico.json            # Historico bruto de batalhas (gerado automaticamente)
├── dados_grafico.json        # Dados processados para o dashboard (gerado automaticamente)
├── dados_arena_global.json   # Estatisticas globais por arena (gerado automaticamente)
├── requirements.txt          # Dependencia: requests
└── .github/workflows/
    └── main.yml              # GitHub Actions - atualizacao diaria automatica
```

## Uso local

```bash
pip install -r requirements.txt
export CLASH_TOKEN="seu_token_aqui"
python cl.py
python arena_global.py
python -m http.server
```

Acesse `http://localhost:8000` no navegador.
