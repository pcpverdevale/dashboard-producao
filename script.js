// Adiciona uma variável para guardar os dados do dashboard após o primeiro carregamento
let dashboardData = null;

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-checkbox');
    const currentTheme = localStorage.getItem('theme') || 'dark';

    // Função para definir o tema e redesenhar os gráficos instantaneamente
    const setTheme = (theme) => {
        document.body.classList.toggle('light-theme', theme === 'light');
        themeToggle.checked = (theme === 'light');

        // Se já temos os dados guardados, apenas redesenha a UI sem buscar na rede
        if (dashboardData) {
            populateUI(dashboardData);
        }
    };

    if (currentTheme === 'light') {
        setTheme('light');
    }

    themeToggle.addEventListener('change', (e) => {
        const newTheme = e.target.checked ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        setTheme(newTheme);
    });
    
    // Inicia o carregamento inicial dos dados
    fetchDashboardData();
});

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby57KhE1sU-_3Mk3xzerV26Qkon-NQpLri7yp194k8InYAD3hm5irWbXpD7rgMk7BOi/exec";
let chartInstances = {};

const vibrantStatusColorMap = {
    "PROJETO": '#87CEFA', "PCP": '#FFB347', "REVISADO": '#CF9EF0', "CORTANDO": '#88D8B0',
    "CORTADO": '#A1CFF0', "NO LOCAL": '#FF9AA2', "MARCENARIA": '#E6C8A4', "EXPEDIÇÃO": '#B5EAD7',
    "PRÉ-MONT.": '#FFDAC1', "MONTAGEM": '#FDFD96', "TARCISIO": '#B19CD9', "FINALIZADO": '#FF6961',
    "DEFAULT": '#D3D3D3'
};

function getCssVar(varName) {
    return getComputedStyle(document.body).getPropertyValue(varName).trim();
}

async function fetchDashboardData() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.remove('hidden');

    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        // Guarda os dados na nossa variável global pela primeira vez
        dashboardData = data; 
        
        if (data.error) throw new Error(data.error);
        populateUI(data);
    } catch (error) {
        console.error("Falha ao buscar dados do dashboard:", error);
        alert("Não foi possível carregar os dados do dashboard: " + error.message);
    } finally {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    }
}

function populateUI(data) {
    const { dadosAnuais, resumoStatusAnoVigente, anoVigente, dadosLevantamento } = data;

    document.querySelectorAll('.ano-vigente').forEach(el => el.textContent = anoVigente);
    const dadosAnoVigente = dadosAnuais?.[anoVigente] || { numPedidos: 0, totalItens: 0, itensFinalizados: 0 };
    document.getElementById('kpi-pedidos').textContent = dadosAnoVigente.numPedidos;
    document.getElementById('kpi-total-itens').textContent = dadosAnoVigente.totalItens;
    document.getElementById('kpi-itens-finalizados').textContent = dadosAnoVigente.itensFinalizados;
    
    const progressoContainer = document.querySelector('#geralItensChart').closest('.card');
    progressoContainer.querySelector('h3').innerHTML = `Progresso de Itens (<span class="ano-vigente">${anoVigente}</span>)`;
    createProgressoChart('geralItensChart', dadosAnoVigente.itensFinalizados, dadosAnoVigente.totalItens - dadosAnoVigente.itensFinalizados);
    
    const statusSemFinalizado = { ...resumoStatusAnoVigente };
    delete statusSemFinalizado['FINALIZADO'];
    
    createStatusChart('statusDonutChart', statusSemFinalizado);
    gerarTabelaAnual(dadosAnuais);
    gerarTabelaStatus(statusSemFinalizado);

    if (dadosLevantamento && Object.keys(dadosLevantamento).length > 0) {
      setupLevantamentoChart(dadosLevantamento);
    }
}

function createProgressoChart(canvasId, finalizados, restantes) {
    if (chartInstances?.[canvasId]) chartInstances[canvasId].destroy();
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Finalizados', 'Restantes'],
            datasets: [{
                data: [finalizados, restantes],
                backgroundColor: [ getCssVar('--primary-green'), getCssVar('--border-color') ],
                borderColor: getCssVar('--card-bg'), 
                borderWidth: 2, hoverOffset: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: true, position: 'bottom', labels: { color: getCssVar('--text-secondary'), padding: 20 } } } }
    });
}

function createStatusChart(canvasId, statusData) {
    if (chartInstances?.[canvasId]) chartInstances[canvasId].destroy();
    const labels = Object.keys(statusData).filter(status => statusData?.[status] > 0);
    const data = labels.map(status => statusData?.[status]);
    const backgroundColors = labels.map(status => vibrantStatusColorMap[status] || vibrantStatusColorMap['DEFAULT']);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: backgroundColors, borderColor: getCssVar('--card-bg'), borderWidth: 2, hoverOffset: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: true, position: 'bottom', labels: { color: getCssVar('--text-secondary'), padding: 15, boxWidth: 15, font: { size: 11 } } } } }
    });
}

function gerarTabelaAnual(dados) {
    const container = document.getElementById('tabela-anual-container');
    if (!container) return;
    const anos = Object.keys(dados).sort((a, b) => a - b);
    let tableHTML = `<table><thead><tr><th>Ano</th><th>Nº de Pedidos</th><th>Total de Itens</th><th>Itens Finalizados</th></tr></thead><tbody>`;
    anos.forEach(ano => {
        const d = dados?.[ano];
        tableHTML += `<tr><td class="highlight">${ano}</td><td>${d?.numPedidos || 0}</td><td>${d?.totalItens || 0}</td><td class="highlight">${d?.itensFinalizados || 0}</td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function gerarTabelaStatus(dados) {
    const container = document.getElementById('tabela-status-container');
    if (!container) return;
    const statusOrdenados = Object.entries(dados).filter(([, qtd]) => qtd > 0).sort(([, a], [, b]) => b - a);
    let tableHTML = `<table><thead><tr><th>Status</th><th>Quantidade</th></tr></thead><tbody>`;
    statusOrdenados.forEach(([status, qtd]) => {
        tableHTML += `<tr><td>${status}</td><td class="highlight">${qtd}</td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function setupLevantamentoChart(dados) {
    const seletor = document.getElementById('levantamento-ano-seletor');
    if (!seletor) return;
    const anos = Object.keys(dados).sort((a, b) => b - a); 

    if (anos.length === 0) return; 

    seletor.innerHTML = anos.map(ano => `<option value="${ano}">${ano}</option>`).join('');
    createLevantamentoGroupedBarChart(anos[0], dados[anos[0]]);
    seletor.addEventListener('change', (e) => {
        createLevantamentoGroupedBarChart(e.target.value, dados[e.target.value]);
    });
}

function createLevantamentoGroupedBarChart(ano, dadosDoAno) {
    const canvasId = 'levantamentoChart';
    if (chartInstances?.[canvasId]) chartInstances[canvasId].destroy();
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const labels = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const cores = {
        chapa: getCssVar('--primary-green'), 
        fita: getCssVar('--light-green')
    };

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'CHAPA CORTADA (m²)',
                    data: dadosDoAno.chapaCortada,
                    backgroundColor: cores.chapa,
                    borderColor: cores.chapa,
                    borderWidth: 1
                },
                {
                    label: 'FITA COLADA (dam)',
                    data: dadosDoAno.fitaColada,
                    backgroundColor: cores.fita,
                    borderColor: cores.fita,
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { color: getCssVar('--text-secondary') }, grid: { color: getCssVar('--border-color') } },
                x: { ticks: { color: getCssVar('--text-secondary') }, grid: { display: false } }
            },
            plugins: {
                legend: { display: true, position: 'top', labels: { color: getCssVar('--text-secondary') } },
                title: { display: false }
            }
        }
    });
}
