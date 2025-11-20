FROM ghcr.io/puppeteer/puppeteer:20.8.1

USER root

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3080

CMD ["node", "server.js"]
