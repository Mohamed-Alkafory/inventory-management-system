FROM node:22-bookworm-slim AS base

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

FROM base AS builder

RUN npx prisma generate

RUN npm run build

FROM node:22-bookworm-slim AS production

WORKDIR /usr/src/app

ENV NODE_ENV=production

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/prisma.config.ts ./prisma.config.ts

RUN mkdir -p /usr/src/app/uploads \
  && chown -R node:node /usr/src/app

USER node

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]