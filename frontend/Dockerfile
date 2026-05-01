# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: prod_deps ────────────────────────────────────────────────────────
FROM node:20-alpine AS prod_deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 4: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=prod_deps /app/node_modules ./node_modules
COPY --from=builder   /app/.next        ./.next
COPY --from=builder   /app/public       ./public
COPY package*.json ./
EXPOSE 3000
CMD ["npm", "start"]