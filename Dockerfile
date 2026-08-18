FROM node:24-alpine AS base

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

RUN addgroup -S gladys && adduser -S gladys -G gladys
USER gladys

ENV NODE_ENV=production

LABEL io.gladysassistant.manifest.path=/app/gladys-assistant-integration.json

CMD ["node", "index.js"]