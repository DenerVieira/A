// Adicione esta dependência: npm install node-fetch
const fetch = require('node-fetch');

// Seu token de acesso (DEVE ser mantido seguro, use as Netlify Environment Variables)
// Por enquanto, usarei o que você forneceu, mas MUDE ISSO para uma ENV VAR!
const TOKEN = "c4e93e161ac7beeac6efb8cfecfab38750f3c0e8f96d2df493ef81ad55340ef5"; 
const BASE_URL = 'http://api.olhovivo.sptrans.com.br/v2.1';
let cookie = null; // Variável para armazenar o cookie de autenticação

// Função de Login para obter o cookie de autenticação
async function login() {
    try {
        console.log("Tentando login na SPTrans...");
        const response = await fetch(`${BASE_URL}/Login/Autenticar?token=${TOKEN}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Login falhou: ${response.statusText}`);
        }

        const newCookie = response.headers.get('set-cookie');
        if (!newCookie) {
            throw new Error("Login bem-sucedido, mas nenhum cookie de sessão retornado.");
        }

        cookie = newCookie.split(';')[0]; // Pega apenas a parte do cookie de sessão (ex: "apiCredentials=...")
        console.log("Login SPTrans bem-sucedido. Cookie obtido.");
        return true;
    } catch (error) {
        console.error("ERRO CRÍTICO DE LOGIN:", error);
        cookie = null;
        return false;
    }
}

// Função Genérica para fazer requisições à API da SPTrans
async function callSptransApi(endpoint) {
    // Tenta usar o cookie existente
    let response = await fetch(`${BASE_URL}/${endpoint}`, {
        headers: {
            'Cookie': cookie
        }
    });

    // Se a requisição falhar (ex: 401 Unauthorized), tenta fazer login novamente
    if (!response.ok && response.status === 401) {
        console.log("Requisição falhou (401), tentando re-login...");
        const loginSuccess = await login();
        
        if (loginSuccess) {
            // Tenta a requisição novamente com o novo cookie
            response = await fetch(`${BASE_URL}/${endpoint}`, {
                headers: {
                    'Cookie': cookie
                }
            });
        }
    }

    if (!response.ok) {
        throw new Error(`Requisição final falhou: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

// Handler da Netlify Function
exports.handler = async (event, context) => {
    // Garante que o cookie existe ou tenta obter um
    if (!cookie) {
        const loginSuccess = await login();
        if (!loginSuccess) {
             return {
                statusCode: 500,
                body: JSON.stringify({ error: "Falha na autenticação com a SPTrans." }),
            };
        }
    }

    const { method, termosBusca, codigoLinha } = event.queryStringParameters;
    let endpoint = '';

    if (method === 'BuscarLinha' && termosBusca) {
        // Encontra o código da linha para rastreamento (sentido 1 por padrão)
        endpoint = `Linha/Buscar?termosBusca=${encodeURIComponent(termosBusca)}`;
    } else if (method === 'PosicaoLinha' && codigoLinha) {
        // Encontra a posição dos veículos de uma linha específica
        endpoint = `Posicao/Linha?codigoLinha=${encodeURIComponent(codigoLinha)}`;
    } else {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Parâmetros 'method' e respectivos campos ausentes ou inválidos." }),
        };
    }

    try {
        const data = await callSptransApi(endpoint);
        
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Erro na API da SPTrans:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Erro ao acessar a API: ${error.message}` }),
        };
    }
};
