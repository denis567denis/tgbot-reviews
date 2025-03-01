FROM node:16 AS builder

ENV API_BOT=${API_BOT}
ENV MONGO_URI=${MONGO_URI}

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx tsc

FROM node:16-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/exelData ./exelData

CMD ["node", "dist/bot.js"]