const map = L.map('map').setView([-23.55, -46.633], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

const searchInput = document.getElementById('search');
const btnSearch = document.getElementById('btnSearch');
const lineList = document.getElementById('lineList');
const btnTrack = document.getElementById('btnTrack');
const btnStop = document.getElementById('btnStop');

let currentCL = null;
let markers = {};
let intervalId = null;

btnSearch.onclick = async () => {
  const q = searchInput.value.trim();
  if (!q) return alert('Digite número ou nome da linha');
  lineList.innerHTML = 'Buscando...';
  const res = await fetch(`/.netlify/functions/sptrans?endpoint=Linha/Buscar&termosBusca=${encodeURIComponent(q)}`);
  const json = await res.json();
  if (!json.data || !json.data.length) {
    lineList.innerHTML = 'Nenhuma linha encontrada';
    return;
  }
  const lines = json.data;
  lineList.innerHTML = '';
  lines.forEach(l => {
    const el = document.createElement('div');
    el.style.cursor = 'pointer';
    el.style.padding = '6px 4px';
    el.textContent = `${l.c} — ${l.tp || l.ts || ''} (cl=${l.cl} sl=${l.sl})`;
    el.onclick = () => selectLine(l);
    lineList.appendChild(el);
  });
};

function selectLine(l) {
  currentCL = l.cl;
  btnTrack.disabled = false;
  btnStop.disabled = true;
  lineList.querySelectorAll('div').forEach(d => d.style.background='');
  event && event.target && (event.target.style.background = '#eef');
}

btnTrack.onclick = () => {
  if (!currentCL) return alert('Selecione uma linha primeiro');
  btnTrack.disabled = true; btnStop.disabled = false;
  fetchAndUpdate();
  intervalId = setInterval(fetchAndUpdate, 10000);
};

btnStop.onclick = () => {
  clearInterval(intervalId); intervalId = null; btnTrack.disabled = false; btnStop.disabled = true;
};

async function fetchAndUpdate() {
  if (!currentCL) return;
  const res = await fetch(`/.netlify/functions/sptrans?endpoint=Posicao&codigoLinha=${encodeURIComponent(currentCL)}`);
  const json = await res.json();
  if (!json.data || !json.data.vs) return console.warn('no vehicles', json);

  const vehicles = json.data.vs;
  const seen = new Set();
  vehicles.forEach(v => {
    const id = v.p;
    seen.add(id);
    const lat = v.py; const lon = v.px;
    if (markers[id]) {
      markers[id].setLatLng([lat, lon]);
    } else {
      const m = L.marker([lat, lon]).addTo(map).bindPopup(`Veículo ${id}<br/>Acessível: ${v.a}`);
      markers[id] = m;
    }
  });
  Object.keys(markers).forEach(id => { if (!seen.has(id)) { map.removeLayer(markers[id]); delete markers[id]; }});
}
