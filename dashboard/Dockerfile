FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
# Use deterministic install when lockfile exists; otherwise fall back to install.
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
