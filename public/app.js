const map = L.map('map').setView([-23.55, -46.633], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

const searchInput = document.getElementById('search');
const btnSearch = document.getElementById('btnSearch');
const lineList = document.getElementById('lineList');
const btnTrack = document.getElementById('btnTrack');
const btnStop = document.getElementById('btnStop');
const statusEl = document.getElementById('status');

let currentCL = null;
let currentSL = null; // 1 or 2 (ida/volta)
let markers = {};
let intervalId = null;
let selectedElement = null;

// simple colored circle icons using DivIcon
function makeIcon(color) {
  return L.divIcon({
    className: '',
    html: `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="${color}" stroke="#000" stroke-width="1"/></svg>`,
    iconSize: [24,24],
    iconAnchor: [12,12]
  });
}
const iconIda = makeIcon('#1f77b4'); // blue
const iconVolta = makeIcon('#d62728'); // red

btnSearch.onclick = async () => {
  const q = searchInput.value.trim();
  if (!q) return alert('Digite número ou nome da linha');
  lineList.innerHTML = 'Buscando...';
  try {
    const res = await fetch(`/.netlify/functions/sptrans?endpoint=Linha/Buscar&termosBusca=${encodeURIComponent(q)}`);
    const json = await res.json();
    const data = json.data;
    if (!data || (Array.isArray(data) && data.length === 0)) {
      lineList.innerHTML = 'Nenhuma linha encontrada';
      return;
    }
    const lines = Array.isArray(data) ? data : [data];
    lineList.innerHTML = '';
    lines.forEach(l => {
      const div = document.createElement('div');
      div.className = 'line-item';
      const numero = l.lt || l.c || '';
      const tp = l.tp || '';
      const ts = l.ts || '';
      const sentidoText = (l.sl === 1) ? `${tp} → ${ts}` : `${ts} → ${tp}`;
      div.textContent = `${numero} — ${sentidoText} (cl=${l.cl} sl=${l.sl})`;
      div.dataset.cl = l.cl;
      div.dataset.sl = l.sl;
      div.onclick = (ev) => {
        if (selectedElement) selectedElement.classList.remove('selected');
        div.classList.add('selected');
        selectedElement = div;
        selectLine(l);
      };
      lineList.appendChild(div);
    });
    statusEl.textContent = `Encontradas ${lines.length} entradas`;
  } catch (err) {
    lineList.innerHTML = 'Erro na busca';
    console.error(err);
    statusEl.textContent = 'Erro ao buscar linhas (veja console)';
  }
};

function selectLine(l) {
  currentCL = l.cl;
  currentSL = l.sl;
  btnTrack.disabled = false;
  btnStop.disabled = true;
  statusEl.textContent = `Linha selecionada: cl=${currentCL} sl=${currentSL}`;
  // clear previous markers
  Object.keys(markers).forEach(k => { map.removeLayer(markers[k]); });
  markers = {};
}

btnTrack.onclick = () => {
  if (!currentCL) return alert('Selecione uma linha primeiro');
  btnTrack.disabled = true; btnStop.disabled = false;
  fetchAndUpdate();
  intervalId = setInterval(fetchAndUpdate, 10000);
  statusEl.textContent = `Rastreando cl=${currentCL} sl=${currentSL}`;
};

btnStop.onclick = () => {
  clearInterval(intervalId); intervalId = null; btnTrack.disabled = false; btnStop.disabled = true;
  statusEl.textContent = 'Rastreamento parado';
};

async function fetchAndUpdate() {
  if (!currentCL) return;
  try {
    const res = await fetch(`/.netlify/functions/sptrans?endpoint=Posicao&codigoLinha=${encodeURIComponent(currentCL)}`);
    const json = await res.json();
    const data = json.data;
    if (!data) {
      console.warn('Resposta vazia da função', json);
      statusEl.textContent = 'Resposta vazia da API (ver console)';
      return;
    }
    
    // Lógica robusta para identificar o array de veículos
    const vehiclesRaw = (typeof data === 'object' && data !== null) ? (data.vs || data) : data;
    const vehicles = Array.isArray(vehiclesRaw) ? vehiclesRaw : []; 

    if (vehicles.length === 0) {
      // Se não há veículos ou a resposta era apenas metadados (ex: { hr: "..." }), o array estará vazio.
      statusEl.textContent = 'Nenhum veículo ativo no momento para essa entrada';
      // remove existing markers
      Object.keys(markers).forEach(id => { map.removeLayer(markers[id]); delete markers[id]; });
      return;
    }
    const seen = new Set();
    
    // CORREÇÃO FINAL DEFENSIVA: Garante que o forEach só é chamado em um Array.
    if (Array.isArray(vehicles)) {
        vehicles.forEach(v => {
            const id = String(v.p);
            seen.add(id);
            const lat = Number(v.py); const lon = Number(v.px);
            if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;
            const icon = (currentSL === 1) ? iconIda : iconVolta;
            if (markers[id]) {
                markers[id].setLatLng([lat, lon]);
            } else {
                const popup = `Veículo ${id}<br/>Acessível: ${v.a}<br/>Hora (UTC): ${v.ta || ''}`;
                const m = L.marker([lat, lon], { icon }).addTo(map).bindPopup(popup);
                markers[id] = m;
            }
        });
    } else {
        // Log de erro caso o código chegue aqui (indica um erro de lógica muito grave ou dado inesperado)
        console.error("ERRO CRÍTICO: 'vehicles' não é um array após as verificações.", vehicles);
        statusEl.textContent = 'Erro interno ao processar dados (ver console)';
        return;
    }
    
    // remove markers not seen now
    Object.keys(markers).forEach(id => { if (!seen.has(id)) { map.removeLayer(markers[id]); delete markers[id]; }});
    // auto-zoom to markers
    const keys = Object.keys(markers);
    if (keys.length) {
      const group = L.featureGroup(keys.map(k => markers[k]));
      map.fitBounds(group.getBounds().pad(0.2));
      statusEl.textContent = `Mostrando ${keys.length} veículos`;
    } else {
      statusEl.textContent = 'Nenhum veículo encontrado no momento';
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Erro ao buscar posições (veja console)';
  }
}
