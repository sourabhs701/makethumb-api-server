FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN apk add --no-cache docker-cli

RUN chmod +x start.sh

CMD ["./start.sh"]
