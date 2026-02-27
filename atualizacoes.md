# Documentação Técnica: Clash Analytics Dashboard

Este documento consolida o escopo completo do sistema de análise de desempenho para Clash Royale, integrando o monitoramento de progresso e a inteligência estratégica de dados.

---

## 1. Monitoramento de Progresso (O Alicerce)

### 1.1 Resumo do Dia (Header Superior)
**Objetivo:** Oferecer uma visão imediata do status atual da conta e do desempenho nas últimas 24 horas.

* **Troféus Atuais:** Exibe em destaque o número de troféus da partida mais recente registrada no banco de dados.
* **Resumo Diário (Últimas 24h):**
    * **Vitórias/Derrotas:** Contagem de vitórias e derrotas desde a primeira partida do dia atual.
    * **Delta de Troféus:** A diferença numérica entre os troféus atuais e os troféus registrados no início do dia (ex: +90 ou -30).
* **Comportamento:** Estes dados são automáticos e estáticos (não são afetados pelo filtro de calendário); eles sempre mostram o estado atual da conta.

### 1.2 Gráfico de Evolução de Troféus (Funcionalidade A)
**Objetivo:** Mapear a trajetória de troféus ao longo do tempo com alta precisão e controle de período.

* **Eixos:**
    * **Eixo Y (Vertical):** Quantidade de troféus.
    * **Eixo X (Horizontal):** Data e hora de cada partida individual.
* **Interatividade de Pontos:**
    * **Tooltips (Dicas de Ferramenta):** Ao passar o mouse sobre qualquer ponto da linha, uma caixa exibe o valor exato de troféus e o horário daquela partida.
* **Filtro de Calendário (Range Picker):**
    * **Interface:** Caixa de seleção única (estilo Airbnb) para definir data de início e fim.
    * **Aplicação:** O gráfico se redesenha instantaneamente para mostrar apenas os dados contidos no intervalo selecionado.
* **Simplificação:** Remoção de filtros de "últimas X partidas" para priorizar a precisão do calendário.

### 1.3 Painel de Indicadores Dinâmicos (Funcionalidade B)
**Objetivo:** Analisar estatisticamente o desempenho dentro do período selecionado no gráfico.

* **Sincronização:** Este painel é dependente do filtro de calendário. Se o gráfico mostrar 4 dias, o painel processará as estatísticas desses 4 dias.
* **Métricas Incluídas:**
    * **Total de Partidas:** Soma de todos os registros no período selecionado.
    * **Quantidade de Vitórias/Derrotas:** Contagem segregada por resultado.
    * **Taxa de Vitória (Win Rate):** Cálculo percentual $(\frac{\text{vitórias}}{\text{total de partidas}}) \times 100$.

---

## 2. Inteligência Estratégica (O Cérebro)

### 2.1 Analisador de Deck e Performance (Funcionalidade C)
* **Descrição:** Algoritmo que identifica automaticamente a combinação de 8 cartas mais utilizada e calcula a taxa de vitória específica para cada variação de deck testada.
* **Detalhamento:** Exibição visual das cartas do "Deck de Ouro" (melhor performance estatística) em comparação com decks secundários.
* **Objetivo:** Validar matematicamente quais composições são realmente eficientes para subir troféus.

### 2.2 Detector de "Hard Counters" (Funcionalidade D)
* **Descrição:** Uma lista das 8 cartas que aparecem com maior frequência nos decks de oponentes em partidas resultantes em derrota.
* **Funcionamento:** O script Python analisa o histórico de derrotas e contabiliza a frequência das cartas adversárias.
* **Objetivo:** Identificar padrões de fraqueza no deck atual e auxiliar no ajuste da estratégia contra as cartas mais problemáticas da faixa de troféus.

---

## Notas de Implementação Técnica

* **Python (`cl.py`):** Deve gerar um arquivo JSON simplificado que inclua timestamp, troféus e o resultado (vitória/derrota) de cada batalha.
* **Frontend (`index.html`):** * Utilização da biblioteca **Chart.js** para o gráfico e tooltips.
    * Implementação do **Flatpickr** para a seleção de intervalos no calendário.
    * Lógica em JavaScript para filtrar o JSON e atualizar os KPIs e o gráfico de forma síncrona.