
FROM node:lts-buster
WORKDIR /app

RUN sed -i 's|http://deb.debian.org/debian|http://archive.debian.org/debian|g' /etc/apt/sources.list \
 && sed -i '/security/d' /etc/apt/sources.list \
 && apt-get -o Acquire::Check-Valid-Until=false update \
 && apt-get install -y \
    ffmpeg \
    imagemagick \
    webp \
    git \
    curl \
 && apt-get upgrade -y \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g pm2


COPY package*.json ./

RUN npm install

COPY . .

RUN mkdir -p /app/session

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["pm2-runtime", "start", "index.js"]

