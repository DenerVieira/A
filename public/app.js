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
let selectedElement = null;

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
    // data might be an array or object; normalize to array
    const lines = Array.isArray(data) ? data : [data];
    lineList.innerHTML = '';
    lines.forEach(l => {
      const div = document.createElement('div');
      div.className = 'line-item';
      // lt (numero), tp (letreiro ida), ts (letreiro volta), sl (sentido)
      const numero = l.lt || l.c || '';
      const tp = l.tp || '';
      const ts = l.ts || '';
      const sentidoText = (l.sl === 1) ? `${tp} → ${ts}` : `${ts} → ${tp}`;
      div.textContent = `${numero} — ${sentidoText} (cl=${l.cl} sl=${l.sl})`;
      div.dataset.cl = l.cl;
      div.onclick = (ev) => {
        // highlight
        if (selectedElement) selectedElement.classList.remove('selected');
        div.classList.add('selected');
        selectedElement = div;
        selectLine(l);
      };
      lineList.appendChild(div);
    });
  } catch (err) {
    lineList.innerHTML = 'Erro na busca';
    console.error(err);
  }
};

function selectLine(l) {
  currentCL = l.cl;
  btnTrack.disabled = false;
  btnStop.disabled = true;
  // center map roughly if available (no coords in this response), optional
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
  try {
    const res = await fetch(`/.netlify/functions/sptrans?endpoint=Posicao&codigoLinha=${encodeURIComponent(currentCL)}`);
    const json = await res.json();
    const data = json.data;
    if (!data || !data.vs) return console.warn('no vehicles', json);
    const vehicles = data.vs;
    const seen = new Set();
    vehicles.forEach(v => {
      const id = String(v.p);
      seen.add(id);
      const lat = v.py; const lon = v.px;
      if (!lat || !lon) return;
      if (markers[id]) {
        markers[id].setLatLng([lat, lon]);
      } else {
        const m = L.marker([lat, lon]).addTo(map).bindPopup(`Veículo ${id}<br/>Acessível: ${v.a}`);
        markers[id] = m;
      }
    });
    Object.keys(markers).forEach(id => { if (!seen.has(id)) { map.removeLayer(markers[id]); delete markers[id]; }});
    // auto-zoom to show all markers if any
    const keys = Object.keys(markers);
    if (keys.length) {
      const group = L.featureGroup(keys.map(k => markers[k]));
      map.fitBounds(group.getBounds().pad(0.2));
    }
  } catch (err) {
    console.error(err);
  }
}
