FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    webp \
    libwebp-dev \
    python3 \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY x-main/package*.json ./

RUN npm install --legacy-peer-deps --omit=dev

COPY x-main/ ./

RUN mkdir -p session temp tmp data assets

ENV NODE_ENV=production

CMD ["node", "server.js"]
