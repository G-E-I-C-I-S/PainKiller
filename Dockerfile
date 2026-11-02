# Imagem única: API (NestJS + Prisma) servindo o painel web já compilado.
FROM node:22-bookworm-slim AS painel
WORKDIR /app/apps/painel
COPY apps/painel/package*.json ./
RUN npm ci
COPY apps/painel ./
RUN npm run build

FROM node:22-bookworm-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm ci --ignore-scripts && npx prisma --version >/dev/null
COPY apps/api ./
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/api
ENV NODE_ENV=production PORTA=3000 PAINEL_DIR=/app/apps/painel/dist
COPY --from=api /app/apps/api ./
COPY --from=painel /app/apps/painel/dist /app/apps/painel/dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
