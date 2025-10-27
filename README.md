# SPTrans Olho Vivo — Netlify + Leaflet (v3)

Esta versão inclui:
- função serverless que autentica antes de cada requisição e repassa cookies para endpoints (melhor compatibilidade);
- UI que exibe corretamente ida/volta para cada entrada (sl=1/2);
- ícones coloridos (azul para ida, vermelho para volta);
- centraliza automaticamente na frota ao rastrear;
- polling a cada 10s (configurável manualmente no código).

Deploy:
1. Suba o conteúdo (public/ + functions/ + netlify.toml) para o Netlify.
2. Defina a variável de ambiente `SPTRANS_TOKEN` no painel do Netlify com seu token (recomendado), ou deixe o fallback embutido no código.
3. Acesse o site e busque por uma linha (ex.: 6L01). Selecione a entrada (ida/volta) e clique em Rastrear.
