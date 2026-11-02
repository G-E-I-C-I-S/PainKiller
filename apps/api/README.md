# API do Guardião

NestJS 11 + Prisma 6 + PostgreSQL. Serve também o painel web (`apps/painel/dist`) quando `PAINEL_DIR` existe.

## Rodar no PC (teste)

```bash
cd apps/api && npm install && npm run dev
```

Sobe um PostgreSQL embutido (`.dados/pg`, porta 5433), aplica as migrações, cria dados de teste e abre a API na porta 3000.
- Painel: `http://localhost:3000` (admin/1234 ou coordenador/1234)
- App, campo Servidor: `http://<IP do PC>:3000/api/v1` (vigilante/1234). O Windows precisa liberar a porta 3000 no firewall.
- Teste ponta a ponta com a API rodando: `node test/fluxo.mjs`

## VM do campus (produção)

```bash
cp infra/docker/.env.exemplo infra/docker/.env   # preencher BANCO_SENHA, JWT_SEGREDO e DOMINIO
docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env up -d --build
docker compose -f infra/docker/docker-compose.prod.yml logs migracao   # senha temporária do admin
```

## Diferenças em relação aos documentos de arquitetura

- JWT HS256 (segredo único) em vez de EdDSA; refresh opaco com rotação e detecção de reuso.
- Fotos guardadas no PostgreSQL (bytea, até 2 MB) em vez de MinIO.
- Sem Redis/BullMQ: o agendador roda dentro da API (`setInterval`, 5 min).
- Um schema só; cadastros sem ETag/If-Match.
- Administrador também acompanha rondas no painel.
- npm por app em vez de pnpm/turborepo.
- `validacaoTag` aceita `NAO_VINCULADA` e `QR_CODE` (sinalizadas para revisão); UID de 8 a 20 hex.
