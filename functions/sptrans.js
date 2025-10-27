const BASE = 'https://api.olhovivo.sptrans.com.br/v2.1';
const FALLBACK_TOKEN = 'c4e93e161ac7beeac6efb8cfecfab38750f3c0e8f96d2df493ef81ad55340ef5';

// Headers CORS
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const endpointRaw = params.endpoint;
    if (!endpointRaw) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({error: 'missing endpoint query param'})
      };
    }
    delete params.endpoint;
    const token = process.env.SPTRANS_TOKEN || FALLBACK_TOKEN;

    // 1) Authenticate
    const authUrl = `${BASE}/Login/Autenticar?token=${encodeURIComponent(token)}`;
    const authRes = await fetch(authUrl, { method: 'POST', redirect: 'manual' });
    const authText = await authRes.text();
    // authText should be "true" when ok
    if (!/true/i.test(authText)) {
      return {
        statusCode: 401,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'authentication failed', details: authText })
      };
    }

    // 2) get cookies robustly
    let cookieHeader = '';
    try {
      // prefer getAll if available (Headers.prototype.getAll is not standard, so try to read raw)
      const sc = authRes.headers.get('set-cookie') || authRes.headers.get('Set-Cookie') || '';
      if (sc) {
        // Extract name=value pairs
        cookieHeader = sc.split(',').map(item => item.trim()).map(part => part.split(';')[0]).join('; ');
      }
    } catch (e) {
      cookieHeader = '';
    }

    // 3) build target url
    const endpoint = endpointRaw.replace(/^\\/+/, '');
    const qs = new URLSearchParams(params).toString();
    const targetUrl = `${BASE}/${endpoint}${qs ? '?' + qs : ''}`;

    const headers = {};
    if (cookieHeader) headers['Cookie'] = cookieHeader;

    // Forward request
    const res = await fetch(targetUrl, { headers, redirect: 'manual' });
    const text = await res.text();
    let body = null; // Inicializamos como null

    try { 
        body = JSON.parse(text); 
    } catch(e) { 
        // CORREÇÃO: Se não for JSON, logamos o erro e mantemos body=null.
        // O app.js irá tratar body=null como "Resposta vazia da função".
        console.warn("SPTrans returned non-JSON text for Posicao endpoint:", text);
        body = null;
    }

    return {
      statusCode: res.status === 200 ? 200 : res.status,
      headers: corsHeaders(),
      body: JSON.stringify({ status: res.status, data: body })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message, stack: err.stack })
    };
  }
};
