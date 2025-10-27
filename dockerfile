FROM node:18-slim

RUN apt-get update && apt-get install -y \
  chromium \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY urbex_world_crawler.mjs .

RUN npm install puppeteer

CMD ["node", "urbex_world_crawler.mjs"]
