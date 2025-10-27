document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialização do Mapa Leaflet
    const map = L.map('map').setView([-23.55052, -46.63330], 12); // São Paulo

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const linhaForm = document.getElementById('linha-form');
    const termoBuscaInput = document.getElementById('termo-busca');
    const linhaInfoDiv = document.getElementById('linha-info');
    const statusDiv = document.getElementById('status');
    let markers = L.layerGroup().addTo(map);
    let trackingInterval = null;
    let linhaAtiva = null;

    const API_PROXY_URL = '/.netlify/functions/sptrans-proxy'; // URL da Netlify Function

    // Ícone personalizado para os ônibus
    const busIcon = L.icon({
        iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#007bff" width="24px" height="24px"><path d="M12 2c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-12h2v6h-2v-6zm0 8h2v2h-2v-2z"/></svg>'),
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    });

    // Função para buscar a linha
    async function buscarLinha(termoBusca) {
        statusDiv.textContent = 'Buscando linha...';
        try {
            // A função BuscarLinhaSentido só retorna a primeira correspondência. Usamos 1 como sentido padrão.
            const response = await fetch(`${API_PROXY_URL}?method=BuscarLinha&termosBusca=${termoBusca}`);
            
            if (!response.ok) {
                throw new Error(`Erro de rede: ${response.status}`);
            }

            const data = await response.json();
            
            if (data && data.length > 0) {
                const linha = data[0];
                linhaAtiva = linha;

                linhaInfoDiv.innerHTML = `
                    <h2>Linha Selecionada: ${linha.lt} ${linha.tl}</h2>
                    <p>Cód. ${linha.cl}</p>
                    <p>Sentido 1: ${linha.tp}</p>
                    <p>Sentido 2: ${linha.ts}</p>
                `;
                statusDiv.textContent = `Linha ${linha.lt}-${linha.tl} (${linha.cl}) encontrada. Iniciando rastreamento...`;
                
                iniciarRastreamento(linha.cl);
            } else {
                linhaInfoDiv.innerHTML = '<h2>Nenhuma linha encontrada.</h2>';
                statusDiv.textContent = 'Busca sem resultados.';
                pararRastreamento();
            }
        } catch (error) {
            console.error("Erro na busca da linha:", error);
            statusDiv.textContent = `Erro ao buscar a linha: ${error.message}`;
            pararRastreamento();
        }
    }

    // Função para buscar e exibir a posição dos veículos
    async function rastrearVeiculos(codigoLinha) {
        statusDiv.textContent = `Atualizando posições da linha ${codigoLinha}...`;
        try {
            const response = await fetch(`${API_PROXY_URL}?method=PosicaoLinha&codigoLinha=${codigoLinha}`);
            
            if (!response.ok) {
                throw new Error(`Erro de rede: ${response.status}`);
            }

            const data = await response.json();
            
            if (data && data.vs && data.vs.length > 0) {
                markers.clearLayers(); // Remove marcadores antigos
                let bounds = [];

                data.vs.forEach(veiculo => {
                    const lat = veiculo.py;
                    const lon = veiculo.px;
                    const prefixo = veiculo.p;
                    const acessivel = veiculo.a ? 'Sim' : 'Não';
                    const horaCaptura = new Date(veiculo.ta).toLocaleTimeString('pt-BR');

                    const marker = L.marker([lat, lon], { icon: busIcon })
                        .bindPopup(`
                            <b>Prefixo:</b> ${prefixo}<br>
                            <b>Acessível:</b> ${acessivel}<br>
                            <b>Última Atualização:</b> ${horaCaptura}
                        `);
                    markers.addLayer(marker);
                    bounds.push([lat, lon]);
                });

                statusDiv.textContent = `Linha ${codigoLinha}: ${data.vs.length} veículos localizados. Última atualização: ${data.hr}`;

                if (bounds.length > 0) {
                    // Ajusta a visualização do mapa para incluir todos os marcadores, se for a primeira vez
                    // ou se a linha mudar. Para atualizações subsequentes, pode-se evitar o fitBounds.
                    if (trackingInterval === null) {
                        map.fitBounds(bounds, { padding: [50, 50] });
                    }
                }
            } else {
                statusDiv.textContent = `Linha ${codigoLinha}: Nenhum veículo localizado. Última atualização: ${data.hr || 'N/A'}`;
                markers.clearLayers();
            }
        } catch (error) {
            console.error("Erro ao rastrear veículos:", error);
            statusDiv.textContent = `Erro ao rastrear veículos: ${error.message}`;
        }
    }

    // Gerencia o intervalo de rastreamento
    function iniciarRastreamento(codigoLinha) {
        pararRastreamento(); // Garante que qualquer intervalo anterior seja limpo
        rastrearVeiculos(codigoLinha); // Executa imediatamente
        // Atualiza a cada 30 segundos
        trackingInterval = setInterval(() => rastrearVeiculos(codigoLinha), 30000); 
    }

    function pararRastreamento() {
        if (trackingInterval) {
            clearInterval(trackingInterval);
            trackingInterval = null;
        }
        markers.clearLayers();
        linhaAtiva = null;
    }

    // 2. Event Listener do Formulário
    linhaForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const termoBusca = termoBuscaInput.value.trim();
        if (termoBusca) {
            buscarLinha(termoBusca);
        }
    });

    // Estado inicial
    statusDiv.textContent = 'Busque uma linha para começar o rastreamento.';
});
