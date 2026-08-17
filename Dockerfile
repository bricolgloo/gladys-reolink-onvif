FROM node:24-alpine AS base

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

# Run as non-root
RUN addgroup -S gladys && adduser -S gladys -G gladys
USER gladys

ENV NODE_ENV=production
CMD ["node", "index.js"]
