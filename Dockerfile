FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3080

CMD ["node", "server.js"]
