#!/bin/sh
set -eu

tentativa=0
until npx prisma migrate deploy; do
  tentativa=$((tentativa + 1))
  if [ "$tentativa" -ge 30 ]; then
    echo "O banco não ficou disponível a tempo."
    exit 1
  fi
  echo "Aguardando o PostgreSQL..."
  sleep 2
done

if [ "${SEED_ON_START:-false}" = "true" ]; then
  npx tsx prisma/seed.ts
fi

exec npx next start -H 0.0.0.0 -p 3000
