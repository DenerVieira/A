# SPTrans Olho Vivo — Netlify + Leaflet (v2)

Atualizei o frontend para exibir corretamente os letreiros de ida e volta (ex.: TERM. VARGINHA → MARSILAC) e para lista todas as entradas retornadas, incluindo sl=1 e sl=2.

Deploy:
1. Coloque os arquivos no repositório: public/ + functions/ + netlify.toml.
2. No Netlify, vá em Site settings -> Build & deploy -> Environment -> Environment variables e adicione SPTRANS_TOKEN com seu token.
3. Conecte o repo no Netlify ou envie zip para deploy.
4. Abra o site e use a busca de linhas. Selecione uma linha e clique em Rastrear.
