# --- Build stage -------------------------------------------------------------
# Node is only needed to produce the static bundle; it is not shipped.
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install dependencies first so the layer is cached while source changes.
COPY package*.json ./
RUN npm ci

COPY . .

# Vite reads import.meta.env at build time. Leaving this empty keeps the
# same-origin default (`/api/v1`), which Nginx proxies to the backend.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# --- Runtime stage -----------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]