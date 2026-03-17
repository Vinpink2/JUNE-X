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

COPY /package*.json ./

RUN npm install --legacy-peer-deps --omit=dev

COPY  ./

RUN mkdir -p session temp tmp data assets

ENV NODE_ENV=production

CMD ["node", "server.js"]
