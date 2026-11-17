FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npx next build \
  && sed -i 's/\r$//' /app/docker-entrypoint.sh \
  && chmod +x /app/docker-entrypoint.sh \
  && node -e "const fs=require('fs'); const p=fs.readFileSync('/app/docker-entrypoint.sh'); if (!p.subarray(0,10).equals(Buffer.from('#!/bin/sh\n')) || p.includes(13)) { console.error('entrypoint sem LF ou shebang invalido'); process.exit(1); }"

ENV NODE_ENV=production
EXPOSE 3000

# sh existe na imagem. O script pode chegar com CRLF; o kernel não executa o shebang nesse caso.
ENTRYPOINT ["sh", "-c", "tr -d '\\r' < /app/docker-entrypoint.sh > /tmp/entrada.sh && exec sh /tmp/entrada.sh"]
