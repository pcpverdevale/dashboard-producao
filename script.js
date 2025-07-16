// URL do seu aplicativo web do Google
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwmnXXRUhJIigPctFu2jKLV00ZXf8N9e2fYAEwF_NcIp54fGJf1jvrDooyrSSM2cwmn/exec";

// Armazenar instâncias de gráficos para destruí-las antes de redesenhar
let chartInstances = {};

// NOVA PALETA: Cores mais saturadas e distintas para cada status
const vibrantStatusColorMap = {
    "PROJETO":    '#87CEFA', // Azul Céu Claro
    "PCP":        '#FFB347', // Laranja Pastel
    "REVISADO":   '#CF9EF0', // Lilás Claro
    "CORTANDO":   '#88D8B0', // Verde Menta Forte (distinto)
    "CORTADO":    '#A1CFF0', // Azul Céu (distinto)
    "NO LOCAL":   '#FF9AA2', // Vermelho/Rosa Suave
    "MARCENARIA": '#E6C8A4', // Bege/Tan
    "EXPEDIÇÃO":  '#B5EAD7', // Verde Menta Claro
    "PRÉ-MONT.":  '#FFDAC1', // Pêssego
    "MONTAGEM":   '#FDFD96', // Amarelo Pastel
    "TARCISIO":   '#B19CD9', // Roxo Pastel
    "FINALIZADO": '#FF6961', // Vermelho Pastel Forte
    "DEFAULT":    '#D3D3D3'  // Cinza Claro
};


async function fetchDashboardData() {
    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        populateUI(data);

    } catch (error) {
        console.error("Falha ao buscar dados do dashboard:", error);
        alert("Não foi possível carregar os dados do dashboard: " + error.message);
    }
}

function populateUI(data) {
    const { dadosAnuais, resumoStatusAnoVigente, anoVigente } = data;

    document.querySelectorAll('.ano-vigente').forEach(el => el.textContent = anoVigente);

    const dadosAnoVigente = dadosAnuais?.[anoVigente] || { numPedidos: 0, totalItens: 0, itensFinalizados: 0 };
    document.getElementById('kpi-pedidos').textContent = dadosAnoVigente.numPedidos;
    document.getElementById('kpi-total-itens').textContent = dadosAnoVigente.totalItens;
    document.getElementById('kpi-itens-finalizados').textContent = dadosAnoVigente.itensFinalizados;

    const progressoContainer = document.querySelector('#geralItensChart').closest('.card');
    progressoContainer.querySelector('h3').innerHTML = `Progresso de Itens (<span class="ano-vigente">${anoVigente}</span>)`;
    const itensRestantes = dadosAnoVigente.totalItens - dadosAnoVigente.itensFinalizados;
    createProgressoChart('geralItensChart', dadosAnoVigente.itensFinalizados, itensRestantes);

    createStatusChart('statusDonutChart', resumoStatusAnoVigente);

    gerarTabelaAnual(dadosAnuais);
    gerarTabelaStatus(resumoStatusAnoVigente);
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
                backgroundColor: [
                    '#a6c6de', // Azul Pastel
                    '#e9a3a3'  // Vermelho Pastel
                ],
                borderColor: '#203a33',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#a0b3ac',
                        padding: 20
                    }
                }
            }
        }
    });
}

function createStatusChart(canvasId, statusData) {
    if (chartInstances?.[canvasId]) chartInstances[canvasId].destroy();

    const labels = Object.keys(statusData).filter(status => statusData?.[status] > 0);
    const data = labels.map(status => statusData?.[status]);
    // AQUI a mágica acontece, usando o novo mapa de cores
    const backgroundColors = labels.map(status => vibrantStatusColorMap[status] || vibrantStatusColorMap['DEFAULT']);

    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderColor: '#203a33',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#a0b3ac',
                        padding: 15,
                        boxWidth: 15,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

function gerarTabelaAnual(dados) {
    const container = document.getElementById('tabela-anual-container');
    if (!container) return;
    const anos = Object.keys(dados).sort((a,b) => a - b);
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

document.addEventListener('DOMContentLoaded', fetchDashboardData);