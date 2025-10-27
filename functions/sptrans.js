const BASE = 'https://api.olhovivo.sptrans.com.br/v2.1';
const FALLBACK_TOKEN = 'c4e93e161ac7beeac6efb8cfecfab38750f3c0e8f96d2df493ef81ad55340ef5';

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

    const authUrl = `${BASE}/Login/Autenticar?token=${encodeURIComponent(token)}`;
    const authRes = await fetch(authUrl, { method: 'POST', redirect: 'manual' });
    const authText = await authRes.text();
    if (!/true/i.test(authText)) {
      return {
        statusCode: 401,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'authentication failed', details: authText })
      };
    }

    const rawSetCookie = authRes.headers.get('set-cookie') || authRes.headers.get('Set-Cookie') || '';
    let cookieHeader = '';
    if (rawSetCookie) {
      cookieHeader = rawSetCookie.split(',').map(piece => piece.trim()).map(part => part.split(';')[0]).join('; ');
    }

    const endpoint = endpointRaw.replace(/^\/+/, '');
    const qs = new URLSearchParams(params).toString();
    const targetUrl = `${BASE}/${endpoint}${qs ? '?' + qs : ''}`;

    const headers = {};
    if (cookieHeader) headers['Cookie'] = cookieHeader;

    const res = await fetch(targetUrl, { headers });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch(e) { body = text; }

    return {
      statusCode: res.status === 200 ? 200 : res.status,
      headers: corsHeaders(),
      body: JSON.stringify({ status: res.status, data: body })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message })
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}
