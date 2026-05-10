FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx --no-save

COPY --from=builder /app/dist ./dist
COPY server.ts tsconfig.json ./

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npx", "tsx", "server.ts"]
