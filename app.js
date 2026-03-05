// ============================================================
// Clash Analytics Dashboard — app.js
// ============================================================

let dadosOriginais = [];
let dadosFiltrados = [];
let dadosArenaGlobal = [];
let meuGrafico;
let graficoNivel;
let donutDistribuicao;
let donutWR;
let picker;
let paginaAtual = 1;
let historicoOrdem = { coluna: 'data', dir: 'desc' };
let abaAtiva = 'visao-geral';
const ITENS_POR_PAGINA = 20;

// ============================================================
// SECURITY — HTML SANITIZATION
// ============================================================
function esc(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ============================================================
// THEME
// ============================================================
function inicializarTema() {
    const saved = localStorage.getItem('clash-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    atualizarBotaoTema(saved);
}

function toggleTema() {
    const atual = document.documentElement.getAttribute('data-theme');
    const novo = atual === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', novo);
    localStorage.setItem('clash-theme', novo);
    atualizarBotaoTema(novo);
    if (dadosFiltrados.length > 0) {
        renderizarGrafico(dadosFiltrados);
        if (abaAtiva === 'nivel') renderizarAnaliseNivel(dadosFiltrados);
    }
}

function atualizarBotaoTema(tema) {
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = tema === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
}

// ============================================================
// TAB NAVIGATION
// ============================================================
function trocarAba(tab) {
    abaAtiva = tab;

    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.toggle('active', el.id === 'tab-' + tab);
    });

    // Render the active tab content (lazy render)
    renderizarAbaAtiva();
}

function renderizarAbaAtiva() {
    switch (abaAtiva) {
        case 'visao-geral':
            renderizarGrafico(dadosFiltrados);
            renderizarKPIs(dadosFiltrados);
            break;
        case 'estrategia':
            renderizarDecks(dadosFiltrados);
            renderizarHardCounters(dadosFiltrados);
            renderizarSoftCounters(dadosFiltrados);
            renderizarWRPorCarta(dadosFiltrados);
            renderizarMatchups(dadosFiltrados);
            break;
        case 'nivel':
            renderizarAnaliseNivel(dadosFiltrados);
            break;
        case 'meta-global':
            renderizarArenaGlobal();
            break;
        case 'historico':
            renderizarHistorico(dadosFiltrados);
            break;
    }
}

// ============================================================
// SKELETON LOADING
// ============================================================
function mostrarSkeletons() {
    document.querySelectorAll('.stat-card .value').forEach(el => {
        el.innerHTML = '<div class="skeleton skeleton-text"></div>';
    });
    document.querySelectorAll('.kpi-value').forEach(el => {
        el.innerHTML = '<div class="skeleton skeleton-kpi"></div>';
    });
    const canvas = document.getElementById('meuGrafico');
    if (canvas) {
        canvas.style.display = 'none';
        const sk = document.createElement('div');
        sk.className = 'skeleton skeleton-chart';
        sk.id = 'skeletonGrafico';
        canvas.parentElement.insertBefore(sk, canvas);
    }
    ['deckAnalise', 'hardCounters', 'softCounters', 'wrPorCarta', 'matchupAnalise'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="skeleton skeleton-block"></div><div class="skeleton skeleton-block"></div>';
    });
}

function removerSkeletons() {
    const sk = document.getElementById('skeletonGrafico');
    if (sk) sk.remove();
    const canvas = document.getElementById('meuGrafico');
    if (canvas) canvas.style.display = '';
}

// ============================================================
// COUNT-UP ANIMATION
// ============================================================
function animarNumero(elemento, valorFinal, duracao = 600, sufixo = '') {
    if (!elemento) return;
    const isFloat = String(valorFinal).includes('.');
    const inicio = performance.now();
    const valorInicial = 0;

    function atualizar(timestamp) {
        const progresso = Math.min((timestamp - inicio) / duracao, 1);
        const eased = 1 - Math.pow(1 - progresso, 3);
        const atual = valorInicial + (valorFinal - valorInicial) * eased;
        elemento.textContent = (isFloat ? atual.toFixed(1) : Math.round(atual)) + sufixo;
        if (progresso < 1) requestAnimationFrame(atualizar);
    }
    requestAnimationFrame(atualizar);
}

// ============================================================
// LOAD DATA
// ============================================================
async function carregarDados() {
    mostrarSkeletons();
    try {
        const response = await fetch('dados_grafico.json');
        dadosOriginais = await response.json();
    } catch (e) {
        console.error('Erro ao carregar dados:', e);
        dadosOriginais = [];
    }
    dadosFiltrados = dadosOriginais;
    paginaAtual = 1;
    removerSkeletons();
    renderizarTudo();
    inicializarFlatpickr();
}

function renderizarTudo() {
    renderizarHeader();
    renderizarAbaAtiva();
}

function renderizarTudoSemHeader() {
    renderizarAbaAtiva();
}

// ============================================================
// 1.1 HEADER (always total data, last 24h)
// ============================================================
function renderizarHeader() {
    if (dadosOriginais.length === 0) return;

    const ultimo = dadosOriginais[dadosOriginais.length - 1];
    const elTrofeus = document.getElementById('trofeusAtuais');
    animarNumero(elTrofeus, ultimo.trofeus, 800);

    const agora = new Date();
    const limite24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    const hoje = dadosOriginais.filter(d => parseDateStr(d.data) >= limite24h);

    if (hoje.length > 0) {
        const vit = hoje.filter(d => d.resultado === 'vitoria').length;
        const der = hoje.filter(d => d.resultado === 'derrota').length;
        const emp = hoje.filter(d => d.resultado === 'empate').length;
        let wlText = `${vit}V / ${der}D`;
        if (emp > 0) wlText += ` / ${emp}E`;
        document.getElementById('wlHoje').textContent = wlText;
        document.getElementById('wlHojeDetalhe').textContent = `${hoje.length} partidas`;

        const trofeusInicio = hoje[0].trofeus;
        const trofeusFim = hoje[hoje.length - 1].trofeus;
        const delta = trofeusFim - trofeusInicio;
        const elDelta = document.getElementById('deltaHoje');
        elDelta.textContent = (delta >= 0 ? '+' : '') + delta;
        elDelta.classList.remove('positivo', 'negativo');
        elDelta.classList.add(delta >= 0 ? 'positivo' : 'negativo');
    } else {
        document.getElementById('wlHoje').textContent = '0V / 0D';
        document.getElementById('wlHojeDetalhe').textContent = 'Sem partidas';
        document.getElementById('deltaHoje').textContent = '0';
    }
}

// ============================================================
// 1.2 CHART with custom external tooltip
// ============================================================
function getExternalTooltipHandler(dados) {
    return function(context) {
        const { chart, tooltip } = context;
        let tooltipEl = document.getElementById('chartTooltip');

        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'chartTooltip';
            tooltipEl.className = 'chart-tooltip';
            document.body.appendChild(tooltipEl);
        }

        if (tooltip.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        const idx = tooltip.dataPoints[0].dataIndex;
        const d = dados[idx];
        const resLabel = d.resultado === 'vitoria' ? 'Vitoria' :
                         d.resultado === 'derrota' ? 'Derrota' : 'Empate';
        const resClass = d.resultado;
        const crownsText = d.crowns_jogador !== undefined
            ? `${d.crowns_jogador} - ${d.crowns_oponente}`
            : '';

        let deckHtml = '';
        if (d.deck && d.deck.length > 0) {
            deckHtml = `<div class="tt-deck-label">Seu Deck</div>
                <div class="tt-deck">${d.deck.map(c => `<img src="${esc(c.icone)}" alt="${esc(c.nome)}" title="${esc(c.nome)}">`).join('')}</div>`;
        }

        tooltipEl.innerHTML = `
            <div class="tt-header">${formatarLabel(d.data)}</div>
            <div class="tt-result">${d.trofeus} trofeus — <span class="resultado-badge ${resClass}">${resLabel}</span> ${crownsText}</div>
            ${deckHtml}
        `;

        tooltipEl.style.opacity = '1';

        const pos = chart.canvas.getBoundingClientRect();
        const left = pos.left + window.scrollX + tooltip.caretX;
        const top = pos.top + window.scrollY + tooltip.caretY;

        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = (top - 10) + 'px';
        tooltipEl.style.transform = 'translate(-50%, -100%)';
    };
}

function renderizarGrafico(dados) {
    const ctx = document.getElementById('meuGrafico');
    if (!ctx) return;
    const context = ctx.getContext('2d');
    const labels = dados.map(d => formatarLabel(d.data));
    const trofeus = dados.map(d => d.trofeus);
    const cores = dados.map(d => {
        if (d.resultado === 'vitoria') return '#4ade80';
        if (d.resultado === 'empate') return '#facc15';
        return '#f87171';
    });

    const minTrofeus = trofeus.length > 0 ? Math.min(...trofeus) : 0;
    const maxTrofeus = trofeus.length > 0 ? Math.max(...trofeus) : 100;
    const padding = Math.max(Math.round((maxTrofeus - minTrofeus) * 0.15), 20);
    const yMin = minTrofeus - padding;
    const yMax = maxTrofeus + padding;

    const tema = document.documentElement.getAttribute('data-theme');
    const gridColor = tema === 'light' ? '#e5e7eb' : '#ffffff10';
    const gridColorX = tema === 'light' ? '#f3f4f6' : '#ffffff08';
    const tickColor = tema === 'light' ? '#6b7280' : '#888';

    if (meuGrafico) {
        meuGrafico.destroy();
        const oldTooltip = document.getElementById('chartTooltip');
        if (oldTooltip) oldTooltip.remove();
    }

    meuGrafico = new Chart(context, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Trofeus',
                data: trofeus,
                borderColor: '#e94560',
                backgroundColor: 'rgba(233, 69, 96, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 5,
                pointBackgroundColor: cores,
                pointBorderColor: cores,
                fill: true
            }]
        },
        options: {
            responsive: true,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: getExternalTooltipHandler(dados)
                }
            },
            scales: {
                y: {
                    min: yMin,
                    max: yMax,
                    ticks: { color: tickColor },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: {
                        color: tickColor,
                        maxRotation: 45,
                        maxTicksLimit: 12
                    },
                    grid: { color: gridColorX }
                }
            }
        }
    });
}

// ============================================================
// 1.3 KPIs
// ============================================================
function renderizarKPIs(dados) {
    const total = dados.length;
    const vitorias = dados.filter(d => d.resultado === 'vitoria').length;
    const derrotas = dados.filter(d => d.resultado === 'derrota').length;
    const empates = dados.filter(d => d.resultado === 'empate').length;
    const winRate = total > 0 ? ((vitorias / total) * 100) : 0;

    animarNumero(document.getElementById('kpiTotal'), total, 500);
    animarNumero(document.getElementById('kpiVitorias'), vitorias, 500);
    animarNumero(document.getElementById('kpiDerrotas'), derrotas, 500);
    animarNumero(document.getElementById('kpiWinRate'), parseFloat(winRate.toFixed(1)), 500, '%');

    const elEmpates = document.getElementById('kpiEmpates');
    if (elEmpates) animarNumero(elEmpates, empates, 500);
}

// ============================================================
// 2.1 DECK ANALYSIS
// ============================================================
function renderizarDecks(dados) {
    const container = document.getElementById('deckAnalise');
    if (!container) return;
    if (dados.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Sem dados no periodo.</p>';
        return;
    }

    const deckMap = {};
    dados.forEach(d => {
        if (!d.deck || d.deck.length === 0) return;
        const chave = d.deck.map(c => c.nome).sort().join('|');
        if (!deckMap[chave]) {
            deckMap[chave] = { cartas: d.deck, total: 0, vitorias: 0 };
        }
        deckMap[chave].total++;
        if (d.resultado === 'vitoria') deckMap[chave].vitorias++;
    });

    const decks = Object.values(deckMap).sort((a, b) => b.total - a.total);

    let html = '';
    decks.forEach((dk, idx) => {
        const wr = dk.total > 0 ? ((dk.vitorias / dk.total) * 100).toFixed(0) : 0;
        const titulo = idx === 0 ? 'Deck Principal' : `Variacao ${idx + 1}`;
        const wrColor = wr >= 50 ? 'var(--win)' : 'var(--lose)';
        html += `
            <div class="deck-entry">
                <div class="deck-header">
                    <span style="font-size:0.85rem;color:var(--text-dim)">${titulo}</span>
                    <span class="wr" style="color:${wrColor}">${wr}% WR — ${dk.vitorias}V/${dk.total - dk.vitorias}D (${dk.total})</span>
                </div>
                <div class="cards-row">
                    ${dk.cartas.map(c => `<img src="${esc(c.icone)}" alt="${esc(c.nome)}" title="${esc(c.nome)}">`).join('')}
                </div>
            </div>`;
    });

    container.innerHTML = html;
}

// ============================================================
// 2.2 HARD COUNTERS
// ============================================================
function renderizarHardCounters(dados) {
    const container = document.getElementById('hardCounters');
    if (!container) return;
    const derrotas = dados.filter(d => d.resultado === 'derrota');

    if (derrotas.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1">Sem derrotas no periodo.</p>';
        return;
    }

    const freq = {};
    derrotas.forEach(d => {
        if (!d.oponente_cartas) return;
        d.oponente_cartas.forEach(c => {
            if (!freq[c.nome]) freq[c.nome] = { nome: c.nome, icone: c.icone, count: 0 };
            freq[c.nome].count++;
        });
    });

    const top = Object.values(freq).sort((a, b) => b.count - a.count).slice(0, 8);
    const totalDerrotas = derrotas.length;

    container.innerHTML = top.map(c => {
        const pct = ((c.count / totalDerrotas) * 100).toFixed(0);
        return `
            <div class="counter-item">
                <img src="${esc(c.icone)}" alt="${esc(c.nome)}" title="${esc(c.nome)}">
                <div class="counter-info">
                    <div class="counter-name">${esc(c.nome)}</div>
                    <div class="counter-freq">Em ${pct}% das derrotas (${c.count}x)</div>
                </div>
            </div>`;
    }).join('');
}

// ============================================================
// 4.1 CARTAS FAVORAVEIS (cartas frequentes nas vitorias)
// ============================================================
function renderizarSoftCounters(dados) {
    const container = document.getElementById('softCounters');
    if (!container) return;

    const vitorias = dados.filter(d => d.resultado === 'vitoria');

    if (vitorias.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1">Sem vitorias no periodo.</p>';
        return;
    }

    const freq = {};
    vitorias.forEach(d => {
        if (!d.oponente_cartas) return;
        d.oponente_cartas.forEach(c => {
            if (!freq[c.nome]) freq[c.nome] = { nome: c.nome, icone: c.icone, count: 0 };
            freq[c.nome].count++;
        });
    });

    const top = Object.values(freq).sort((a, b) => b.count - a.count).slice(0, 8);
    const totalVitorias = vitorias.length;

    container.innerHTML = top.map(c => {
        const pct = ((c.count / totalVitorias) * 100).toFixed(0);
        return `
            <div class="counter-item">
                <img src="${esc(c.icone)}" alt="${esc(c.nome)}" title="${esc(c.nome)}">
                <div class="counter-info">
                    <div class="counter-name">${esc(c.nome)}</div>
                    <div class="counter-freq win-freq">Em ${pct}% das vitorias (${c.count}x)</div>
                </div>
            </div>`;
    }).join('');
}

// ============================================================
// 4.2 WIN RATE POR CARTA ADVERSARIA
// ============================================================
function renderizarWRPorCarta(dados) {
    const container = document.getElementById('wrPorCarta');
    if (!container) return;

    if (dados.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Sem dados no periodo.</p>';
        return;
    }

    const cartaStats = {};
    dados.forEach(d => {
        if (!d.oponente_cartas) return;
        d.oponente_cartas.forEach(c => {
            if (!cartaStats[c.nome]) cartaStats[c.nome] = { nome: c.nome, icone: c.icone, total: 0, vitorias: 0 };
            cartaStats[c.nome].total++;
            if (d.resultado === 'vitoria') cartaStats[c.nome].vitorias++;
        });
    });

    const cartas = Object.values(cartaStats)
        .filter(c => c.total >= 3)
        .map(c => ({ ...c, wr: (c.vitorias / c.total) * 100 }))
        .sort((a, b) => a.wr - b.wr);

    if (cartas.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Dados insuficientes (min. 3 aparicoes).</p>';
        return;
    }

    container.innerHTML = cartas.slice(0, 15).map(c => {
        const wrColor = c.wr >= 50 ? 'var(--win)' : 'var(--lose)';
        return `
            <div class="wr-card-item">
                <img src="${esc(c.icone)}" alt="${esc(c.nome)}" title="${esc(c.nome)}">
                <div class="wr-info">
                    <div class="wr-name">${esc(c.nome)}</div>
                    <div class="wr-detail">${c.vitorias}V / ${c.total} partidas</div>
                </div>
                <div class="wr-bar-container">
                    <div class="wr-bar" style="width:${c.wr}%;background:${wrColor}"></div>
                </div>
                <div class="wr-pct" style="color:${wrColor}">${c.wr.toFixed(0)}%</div>
            </div>`;
    }).join('');
}

// ============================================================
// 4.3 MATCHUP ANALYSIS (ARCHETYPES)
// ============================================================
const ARQUETIPOS = {
    'Golem': { nome: 'Golem Beatdown', icone: null },
    'Lava Hound': { nome: 'Lavaloon', icone: null },
    'Hog Rider': { nome: 'Hog Cycle', icone: null },
    'Giant': { nome: 'Giant Beatdown', icone: null },
    'Royal Giant': { nome: 'Royal Giant', icone: null },
    'Mega Knight': { nome: 'Mega Knight', icone: null },
    'P.E.K.K.A': { nome: 'PEKKA Bridge Spam', icone: null },
    'Graveyard': { nome: 'Graveyard Control', icone: null },
    'X-Bow': { nome: 'X-Bow Siege', icone: null },
    'Mortar': { nome: 'Mortar Cycle', icone: null },
    'Balloon': { nome: 'Balloon', icone: null },
    'Three Musketeers': { nome: 'Three Musketeers', icone: null },
    'Goblin Giant': { nome: 'Sparky Beatdown', icone: null },
    'Elixir Golem': { nome: 'Elixir Golem', icone: null },
    'Ram Rider': { nome: 'Ram Rider', icone: null },
    'Miner': { nome: 'Miner Control', icone: null },
    'Wall Breakers': { nome: 'Wall Breakers', icone: null },
    'Skeleton King': { nome: 'Skeleton King', icone: null },
    'Monk': { nome: 'Monk', icone: null },
    'Phoenix': { nome: 'Phoenix', icone: null },
    'Goblin Barrel': { nome: 'Logbait', icone: null },
};

function detectarArquetipo(oponenteCartas) {
    if (!oponenteCartas || oponenteCartas.length === 0) return null;
    const nomes = oponenteCartas.map(c => c.nome);
    for (const [winCon, info] of Object.entries(ARQUETIPOS)) {
        if (nomes.includes(winCon)) {
            const carta = oponenteCartas.find(c => c.nome === winCon);
            return { nome: info.nome, icone: carta ? carta.icone : '', winCon: winCon };
        }
    }
    return null;
}

function renderizarMatchups(dados) {
    const container = document.getElementById('matchupAnalise');
    if (!container) return;

    if (dados.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Sem dados no periodo.</p>';
        return;
    }

    const matchups = {};
    dados.forEach(d => {
        const arq = detectarArquetipo(d.oponente_cartas);
        if (!arq) return;
        if (!matchups[arq.nome]) matchups[arq.nome] = { nome: arq.nome, icone: arq.icone, total: 0, vitorias: 0 };
        matchups[arq.nome].total++;
        if (d.resultado === 'vitoria') matchups[arq.nome].vitorias++;
    });

    const lista = Object.values(matchups)
        .filter(m => m.total >= 2)
        .map(m => ({ ...m, wr: (m.vitorias / m.total) * 100 }))
        .sort((a, b) => b.total - a.total);

    if (lista.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Dados insuficientes.</p>';
        return;
    }

    container.innerHTML = '<div class="matchup-list">' + lista.map(m => {
        const wrColor = m.wr >= 50 ? 'var(--win)' : 'var(--lose)';
        return `
            <div class="matchup-item">
                <img src="${esc(m.icone)}" alt="${esc(m.nome)}" title="${esc(m.nome)}">
                <div class="matchup-info">
                    <div class="matchup-name">${esc(m.nome)}</div>
                    <div class="matchup-detail">${m.vitorias}V / ${m.total - m.vitorias}D (${m.total} partidas)</div>
                </div>
                <div class="matchup-wr" style="color:${wrColor}">${m.wr.toFixed(0)}%</div>
            </div>`;
    }).join('') + '</div>';
}

// ============================================================
// 5. ARENA GLOBAL ANALYSIS
// ============================================================
async function carregarDadosGlobais() {
    try {
        const response = await fetch('dados_arena_global.json');
        dadosArenaGlobal = await response.json();
    } catch (e) {
        dadosArenaGlobal = [];
    }
    inicializarArenaSelect();
}

function inicializarArenaSelect() {
    const select = document.getElementById('arenaSelect');
    if (!select) return;

    if (dadosArenaGlobal.length === 0) {
        select.innerHTML = '<option value="">Sem dados globais</option>';
        document.getElementById('arenaGlobalContent').innerHTML =
            '<p style="color:var(--text-muted)">Dados globais ainda nao coletados. Execute arena_global.py para coletar.</p>';
        return;
    }

    const trofeuAtual = dadosOriginais.length > 0 ? dadosOriginais[dadosOriginais.length - 1].trofeus : 0;
    const arenaJogador = dadosArenaGlobal.findIndex(a => trofeuAtual >= a.min_trofeus && trofeuAtual <= a.max_trofeus);
    let arenaSelecionada = arenaJogador;

    if (arenaSelecionada >= 0 && dadosArenaGlobal[arenaSelecionada].total_partidas === 0) {
        const comDados = dadosArenaGlobal
            .map((a, i) => ({ idx: i, partidas: a.total_partidas }))
            .filter(a => a.partidas > 0);
        if (comDados.length > 0) {
            arenaSelecionada = comDados.reduce((prev, curr) =>
                Math.abs(curr.idx - arenaJogador) < Math.abs(prev.idx - arenaJogador) ? curr : prev
            ).idx;
        }
    }

    select.innerHTML = dadosArenaGlobal.map((arena, idx) => {
        return `<option value="${idx}" ${idx === arenaSelecionada ? 'selected' : ''}>${arena.faixa} (${arena.total_partidas} partidas)</option>`;
    }).join('');

    if (abaAtiva === 'meta-global') renderizarArenaGlobal();
}

function renderizarArenaGlobal() {
    const select = document.getElementById('arenaSelect');
    const container = document.getElementById('arenaGlobalContent');
    if (!select || !container) return;

    const idx = parseInt(select.value);
    if (isNaN(idx) || !dadosArenaGlobal[idx]) {
        container.innerHTML = '<p style="color:var(--text-muted)">Selecione uma arena.</p>';
        return;
    }

    const arena = dadosArenaGlobal[idx];

    if (!arena.cartas || arena.cartas.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Dados insuficientes para esta arena.</p>';
        return;
    }

    const totalUsos = arena.cartas.reduce((acc, c) => acc + c.uso, 0);
    const topUsadas = arena.cartas.slice(0, 15);

    const topWR = [...arena.cartas]
        .filter(c => c.uso >= 5)
        .sort((a, b) => b.winRate - a.winRate)
        .slice(0, 10);

    const pioresWR = [...arena.cartas]
        .filter(c => c.uso >= 5)
        .sort((a, b) => a.winRate - b.winRate)
        .slice(0, 10);

    let html = `
        <div class="arena-stats-summary">
            <span class="arena-badge">${arena.total_partidas} partidas analisadas</span>
            <span class="arena-badge">${arena.cartas.length} cartas encontradas</span>
        </div>

        <div class="arena-section">
            <h3 class="arena-section-title">Cartas Mais Usadas</h3>
            <div class="arena-card-list">
                ${topUsadas.map((c, i) => {
                    const pctUso = totalUsos > 0 ? ((c.uso / (arena.total_partidas || 1)) * 100).toFixed(0) : 0;
                    const wrColor = c.winRate >= 50 ? 'var(--win)' : 'var(--lose)';
                    return `
                        <div class="arena-card-item">
                            <span class="arena-rank">#${i + 1}</span>
                            <img src="${esc(c.icone)}" alt="${esc(c.nome)}" title="${esc(c.nome)}">
                            <div class="arena-card-info">
                                <div class="arena-card-name">${esc(c.nome)}</div>
                                <div class="arena-card-detail">${pctUso}% uso — ${c.uso}x</div>
                            </div>
                            <div class="arena-card-wr" style="color:${wrColor}">${c.winRate}% WR</div>
                        </div>`;
                }).join('')}
            </div>
        </div>

        <div class="arena-grid-2col">
            <div class="arena-section">
                <h3 class="arena-section-title" style="color:var(--win)">Maiores Win Rates</h3>
                <div class="arena-card-list compact">
                    ${topWR.map(c => {
                        return `
                            <div class="arena-card-item compact">
                                <img src="${esc(c.icone)}" alt="${esc(c.nome)}" title="${esc(c.nome)}">
                                <div class="arena-card-info">
                                    <div class="arena-card-name">${esc(c.nome)}</div>
                                    <div class="arena-card-detail">${c.vitorias}V / ${c.uso} partidas</div>
                                </div>
                                <div class="arena-card-wr" style="color:var(--win)">${c.winRate}%</div>
                            </div>`;
                    }).join('')}
                </div>
            </div>
            <div class="arena-section">
                <h3 class="arena-section-title" style="color:var(--lose)">Piores Win Rates</h3>
                <div class="arena-card-list compact">
                    ${pioresWR.map(c => {
                        return `
                            <div class="arena-card-item compact">
                                <img src="${esc(c.icone)}" alt="${esc(c.nome)}" title="${esc(c.nome)}">
                                <div class="arena-card-info">
                                    <div class="arena-card-name">${esc(c.nome)}</div>
                                    <div class="arena-card-detail">${c.vitorias}V / ${c.uso} partidas</div>
                                </div>
                                <div class="arena-card-wr" style="color:var(--lose)">${c.winRate}%</div>
                            </div>`;
                    }).join('')}
                </div>
            </div>
        </div>`;

    container.innerHTML = html;
}

// ============================================================
// 6. ANALISE DE NIVEL
// ============================================================
function calcularNivelMedio(cartas) {
    if (!cartas || cartas.length === 0) return 0;
    const soma = cartas.reduce((acc, c) => acc + (c.nivel || 0), 0);
    return soma / cartas.length;
}

function renderizarAnaliseNivel(dados) {
    if (dados.length === 0) {
        document.getElementById('nivelDestaques').innerHTML = '<p style="color:var(--text-muted)">Sem dados no periodo.</p>';
        return;
    }

    // Calcular nivel medio de cada partida
    const partidasComNivel = dados
        .filter(d => d.deck && d.deck.length > 0 && d.oponente_cartas && d.oponente_cartas.length > 0)
        .map(d => {
            const meuNivel = calcularNivelMedio(d.deck);
            const opoNivel = calcularNivelMedio(d.oponente_cartas);
            const diff = meuNivel - opoNivel;
            return { ...d, meuNivel, opoNivel, diff };
        });

    if (partidasComNivel.length === 0) {
        document.getElementById('nivelDestaques').innerHTML = '<p style="color:var(--text-muted)">Sem dados de nivel disponveis.</p>';
        return;
    }

    // --- KPIs ---
    const mediaMeuNivel = partidasComNivel.reduce((a, p) => a + p.meuNivel, 0) / partidasComNivel.length;
    const mediaOpoNivel = partidasComNivel.reduce((a, p) => a + p.opoNivel, 0) / partidasComNivel.length;
    const mediaDiff = mediaMeuNivel - mediaOpoNivel;

    // Threshold para "nivelado": diferenca <= 0.5
    const THRESHOLD = 0.5;
    const emDesvantagem = partidasComNivel.filter(p => p.diff < -THRESHOLD);
    const emVantagem = partidasComNivel.filter(p => p.diff > THRESHOLD);
    const nivelados = partidasComNivel.filter(p => Math.abs(p.diff) <= THRESHOLD);

    const pctDesv = ((emDesvantagem.length / partidasComNivel.length) * 100).toFixed(0);
    const pctVant = ((emVantagem.length / partidasComNivel.length) * 100).toFixed(0);
    const pctNiv = ((nivelados.length / partidasComNivel.length) * 100).toFixed(0);

    animarNumero(document.getElementById('kpiSeuNivel'), parseFloat(mediaMeuNivel.toFixed(1)), 500);
    animarNumero(document.getElementById('kpiOpoNivel'), parseFloat(mediaOpoNivel.toFixed(1)), 500);

    const elDif = document.getElementById('kpiDifNivel');
    if (elDif) {
        const difStr = (mediaDiff >= 0 ? '+' : '') + mediaDiff.toFixed(1);
        elDif.textContent = difStr;
        elDif.style.color = mediaDiff >= 0 ? 'var(--win)' : 'var(--lose)';
    }

    const elDesv = document.getElementById('kpiDesv');
    if (elDesv) animarNumero(elDesv, parseInt(pctDesv), 500, '%');

    const elVant = document.getElementById('kpiVant');
    if (elVant) animarNumero(elVant, parseInt(pctVant), 500, '%');

    const elNiv = document.getElementById('kpiNivelado');
    if (elNiv) animarNumero(elNiv, parseInt(pctNiv), 500, '%');

    // --- Grafico de Barras: WR por Faixa de Diferenca ---
    const faixas = [
        { label: '-3 ou menos', min: -Infinity, max: -2.5 },
        { label: '-2.5 a -1.1', min: -2.5, max: -0.5 },
        { label: '-1.0 a -0.1', min: -0.5, max: 0 },
        { label: '0.0 a +0.9', min: 0, max: 0.5 },
        { label: '+1.0 a +2.0', min: 0.5, max: 2.5 },
        { label: '+2.0 ou mais', min: 2.5, max: Infinity },
    ];

    const dadosFaixas = faixas.map(f => {
        const partidas = partidasComNivel.filter(p => {
            if (f.min === -Infinity) return p.diff <= f.max;
            if (f.max === Infinity) return p.diff > f.min;
            return p.diff > f.min && p.diff <= f.max;
        });
        const vitorias = partidas.filter(p => p.resultado === 'vitoria').length;
        const wr = partidas.length > 0 ? (vitorias / partidas.length) * 100 : 0;
        return { label: f.label, total: partidas.length, vitorias, wr };
    });

    const tema = document.documentElement.getAttribute('data-theme');
    const tickColor = tema === 'light' ? '#6b7280' : '#888';
    const gridColor = tema === 'light' ? '#e5e7eb' : '#ffffff10';

    // Bar chart
    const ctxNivel = document.getElementById('graficoNivel');
    if (ctxNivel) {
        if (graficoNivel) graficoNivel.destroy();

        const barColors = dadosFaixas.map(f => {
            if (f.wr >= 60) return '#4ade80';
            if (f.wr >= 50) return '#86efac';
            if (f.wr >= 40) return '#facc15';
            return '#f87171';
        });

        graficoNivel = new Chart(ctxNivel.getContext('2d'), {
            type: 'bar',
            data: {
                labels: dadosFaixas.map(f => f.label),
                datasets: [{
                    label: 'Win Rate %',
                    data: dadosFaixas.map(f => f.wr),
                    backgroundColor: barColors,
                    borderRadius: 6,
                    maxBarThickness: 60,
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const f = dadosFaixas[ctx.dataIndex];
                                return `WR: ${f.wr.toFixed(1)}% (${f.vitorias}V / ${f.total} partidas)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: { color: tickColor, callback: v => v + '%' },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { color: tickColor, font: { size: 11 } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // --- Donuts ---
    const donutColors = {
        desv: '#f87171',
        niv: '#facc15',
        vant: '#4ade80',
    };

    // Donut 1: Distribuicao
    const ctxDonut1 = document.getElementById('donutDistribuicao');
    if (ctxDonut1) {
        if (donutDistribuicao) donutDistribuicao.destroy();

        donutDistribuicao = new Chart(ctxDonut1.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Desvantagem', 'Nivelado', 'Vantagem'],
                datasets: [{
                    data: [emDesvantagem.length, nivelados.length, emVantagem.length],
                    backgroundColor: [donutColors.desv, donutColors.niv, donutColors.vant],
                    borderWidth: 0,
                }]
            },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: tickColor, padding: 12, font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const total = partidasComNivel.length;
                                const val = ctx.raw;
                                const pct = ((val / total) * 100).toFixed(0);
                                return `${ctx.label}: ${val} partidas (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Donut 2: Win Rate por grupo
    const wrDesv = emDesvantagem.length > 0
        ? (emDesvantagem.filter(p => p.resultado === 'vitoria').length / emDesvantagem.length) * 100 : 0;
    const wrNiv = nivelados.length > 0
        ? (nivelados.filter(p => p.resultado === 'vitoria').length / nivelados.length) * 100 : 0;
    const wrVant = emVantagem.length > 0
        ? (emVantagem.filter(p => p.resultado === 'vitoria').length / emVantagem.length) * 100 : 0;

    const ctxDonut2 = document.getElementById('donutWR');
    if (ctxDonut2) {
        if (donutWR) donutWR.destroy();

        donutWR = new Chart(ctxDonut2.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: [
                    `Desvantagem (${wrDesv.toFixed(0)}%)`,
                    `Nivelado (${wrNiv.toFixed(0)}%)`,
                    `Vantagem (${wrVant.toFixed(0)}%)`
                ],
                datasets: [{
                    data: [wrDesv, wrNiv, wrVant],
                    backgroundColor: [donutColors.desv, donutColors.niv, donutColors.vant],
                    borderWidth: 0,
                }]
            },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: tickColor, padding: 12, font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const grupos = [emDesvantagem, nivelados, emVantagem];
                                const grupo = grupos[ctx.dataIndex];
                                const vit = grupo.filter(p => p.resultado === 'vitoria').length;
                                return `WR: ${ctx.raw.toFixed(1)}% (${vit}V / ${grupo.length} partidas)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // --- Destaques ---
    const destaquesEl = document.getElementById('nivelDestaques');
    if (destaquesEl) {
        // Vitorias heroicas: vencer com diff <= -2
        const vitHeroicas = partidasComNivel.filter(p => p.diff <= -2 && p.resultado === 'vitoria');
        // Derrotas inesperadas: perder com diff >= +1
        const derInesperadas = partidasComNivel.filter(p => p.diff >= 1 && p.resultado === 'derrota');

        // Impacto estimado: se WR em desvantagem fosse igual ao nivelado
        let trofeusPerdidos = 0;
        if (emDesvantagem.length > 0 && wrNiv > wrDesv) {
            const vitoriasExtras = Math.round(emDesvantagem.length * (wrNiv - wrDesv) / 100);
            trofeusPerdidos = vitoriasExtras * 30; // ~30 trofeus por vitoria
        }

        destaquesEl.innerHTML = `
            <div class="nivel-destaques-grid">
                <div class="nivel-destaque-card">
                    <div class="destaque-valor" style="color:var(--win)">${vitHeroicas.length}</div>
                    <div class="destaque-label">Vitorias Heroicas</div>
                    <div class="destaque-desc">Vitorias com nivel medio 2+ abaixo do oponente</div>
                </div>
                <div class="nivel-destaque-card">
                    <div class="destaque-valor" style="color:var(--lose)">${derInesperadas.length}</div>
                    <div class="destaque-label">Derrotas Inesperadas</div>
                    <div class="destaque-desc">Derrotas com nivel medio 1+ acima do oponente</div>
                </div>
                <div class="nivel-destaque-card">
                    <div class="destaque-valor" style="color:var(--accent)">~${trofeusPerdidos}</div>
                    <div class="destaque-label">Trofeus Perdidos</div>
                    <div class="destaque-desc">Estimativa de trofeus perdidos por desvantagem de nivel</div>
                </div>
            </div>
        `;
    }
}

// ============================================================
// COUNTER TAB SWITCHING
// ============================================================
function alternarCounterTab(tipo) {
    const hardEl = document.getElementById('hardCounters');
    const softEl = document.getElementById('softCounters');
    const tabs = document.querySelectorAll('.panel-tabs .panel-tab');

    tabs.forEach(t => t.classList.remove('active'));

    if (tipo === 'hard') {
        hardEl.style.display = '';
        softEl.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        hardEl.style.display = 'none';
        softEl.style.display = '';
        tabs[1].classList.add('active');
    }
}

// ============================================================
// 3.1 QUICK FILTERS
// ============================================================
function aplicarFiltroRapido(tipo) {
    document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('ativo'));

    const agora = new Date();
    let inicio;

    switch (tipo) {
        case 'hoje':
            inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            break;
        case '7dias':
            inicio = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30dias':
            inicio = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case 'mes':
            inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
            break;
        default:
            dadosFiltrados = dadosOriginais;
            paginaAtual = 1;
            renderizarTudoSemHeader();
            return;
    }

    const btn = document.querySelector(`.btn-filtro[data-filtro="${tipo}"]`);
    if (btn) btn.classList.add('ativo');

    if (picker) picker.clear();

    dadosFiltrados = dadosOriginais.filter(d => parseDateStr(d.data) >= inicio);
    paginaAtual = 1;
    renderizarTudoSemHeader();
}

function limparFiltro() {
    if (picker) picker.clear();
    document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('ativo'));
    dadosFiltrados = dadosOriginais;
    paginaAtual = 1;
    renderizarTudoSemHeader();
}

// ============================================================
// 3.2 MATCH HISTORY TABLE
// ============================================================
function renderizarHistorico(dados) {
    const container = document.getElementById('historicoTabela');
    if (!container) return;

    if (dados.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Sem dados no periodo.</p>';
        document.getElementById('historicoPaginacao').innerHTML = '';
        return;
    }

    let sorted = [...dados];
    sorted.sort((a, b) => {
        let va, vb;
        switch (historicoOrdem.coluna) {
            case 'data':
                va = parseDateStr(a.data).getTime();
                vb = parseDateStr(b.data).getTime();
                break;
            case 'trofeus':
                va = a.trofeus;
                vb = b.trofeus;
                break;
            case 'resultado':
                const ordem = { vitoria: 0, empate: 1, derrota: 2 };
                va = ordem[a.resultado] || 1;
                vb = ordem[b.resultado] || 1;
                break;
            default:
                va = 0; vb = 0;
        }
        return historicoOrdem.dir === 'asc' ? va - vb : vb - va;
    });

    const totalPaginas = Math.ceil(sorted.length / ITENS_POR_PAGINA);
    if (totalPaginas > 0 && paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const pagina = sorted.slice(inicio, inicio + ITENS_POR_PAGINA);

    const sortArrow = (col) => {
        if (historicoOrdem.coluna !== col) return '';
        return `<span class="sort-arrow">${historicoOrdem.dir === 'asc' ? '\u25B2' : '\u25BC'}</span>`;
    };

    let html = `
        <div class="tabela-historico-wrapper">
        <table class="tabela-historico">
            <thead>
                <tr>
                    <th onclick="ordenarHistorico('data')">Data ${sortArrow('data')}</th>
                    <th onclick="ordenarHistorico('resultado')">Resultado ${sortArrow('resultado')}</th>
                    <th onclick="ordenarHistorico('trofeus')">Trofeus ${sortArrow('trofeus')}</th>
                    <th>Deck</th>
                    <th>Crowns</th>
                    <th>Deck Oponente</th>
                </tr>
            </thead>
            <tbody>`;

    pagina.forEach(d => {
        const resLabel = d.resultado === 'vitoria' ? 'Vitoria' :
                         d.resultado === 'derrota' ? 'Derrota' : 'Empate';
        const crowns = d.crowns_jogador !== undefined
            ? `${d.crowns_jogador} - ${d.crowns_oponente}`
            : '-';

        html += `
            <tr>
                <td>${formatarLabel(d.data)}</td>
                <td><span class="resultado-badge ${d.resultado}">${resLabel}</span></td>
                <td>${d.trofeus}</td>
                <td><div class="mini-deck">${(d.deck || []).map(c => `<img src="${esc(c.icone)}" alt="${esc(c.nome)}" title="${esc(c.nome)}">`).join('')}</div></td>
                <td style="text-align:center;font-weight:600;white-space:nowrap">${crowns}</td>
                <td><div class="mini-deck">${(d.oponente_cartas || []).map(c => `<img src="${esc(c.icone)}" alt="${esc(c.nome)}" title="${esc(c.nome)}">`).join('')}</div></td>
            </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    const pagEl = document.getElementById('historicoPaginacao');
    if (totalPaginas <= 1) {
        pagEl.innerHTML = '';
        return;
    }

    pagEl.innerHTML = `
        <button onclick="mudarPagina(-1)" ${paginaAtual <= 1 ? 'disabled' : ''}>&laquo; Anterior</button>
        <span>${paginaAtual} / ${totalPaginas}</span>
        <button onclick="mudarPagina(1)" ${paginaAtual >= totalPaginas ? 'disabled' : ''}>Proximo &raquo;</button>
    `;
}

function ordenarHistorico(coluna) {
    if (historicoOrdem.coluna === coluna) {
        historicoOrdem.dir = historicoOrdem.dir === 'asc' ? 'desc' : 'asc';
    } else {
        historicoOrdem.coluna = coluna;
        historicoOrdem.dir = 'desc';
    }
    renderizarHistorico(dadosFiltrados);
}

function mudarPagina(delta) {
    paginaAtual += delta;
    renderizarHistorico(dadosFiltrados);
}

// ============================================================
// FLATPICKR
// ============================================================
function inicializarFlatpickr() {
    const datas = dadosOriginais.map(d => parseDateStr(d.data));
    const minDate = datas.length > 0 ? datas[0] : new Date();
    const maxDate = datas.length > 0 ? datas[datas.length - 1] : new Date();

    picker = flatpickr('#rangePicker', {
        mode: 'range',
        dateFormat: 'd/m/Y',
        minDate: minDate,
        maxDate: maxDate,
        theme: 'dark',
        locale: {
            firstDayOfWeek: 1,
            weekdays: { shorthand: ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'], longhand: ['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'] },
            months: { shorthand: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'], longhand: ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'] },
            rangeSeparator: ' ate '
        },
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
                document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('ativo'));
                const inicio = selectedDates[0];
                const fim = new Date(selectedDates[1]);
                fim.setHours(23, 59, 59, 999);
                dadosFiltrados = dadosOriginais.filter(d => {
                    const dt = parseDateStr(d.data);
                    return dt >= inicio && dt <= fim;
                });
                paginaAtual = 1;
                renderizarTudoSemHeader();
            }
        }
    });
}

// ============================================================
// UTILITIES
// ============================================================
function parseDateStr(str) {
    const s = str.replace(/[^\d]/g, '');
    const y = parseInt(s.substring(0, 4));
    const m = parseInt(s.substring(4, 6)) - 1;
    const d = parseInt(s.substring(6, 8));
    const h = parseInt(s.substring(8, 10)) || 0;
    const min = parseInt(s.substring(10, 12)) || 0;
    const sec = parseInt(s.substring(12, 14)) || 0;
    return new Date(Date.UTC(y, m, d, h, min, sec));
}

function formatarLabel(str) {
    const dt = parseDateStr(str);
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const hh = String(dt.getUTCHours()).padStart(2, '0');
    const min = String(dt.getUTCMinutes()).padStart(2, '0');
    return `${dd}/${mm} ${hh}:${min}`;
}

// ============================================================
// SERVICE WORKER REGISTRATION
// ============================================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ============================================================
// INIT
// ============================================================
inicializarTema();
carregarDados();
carregarDadosGlobais();
