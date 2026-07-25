#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Exiting."
  exit 1
fi

echo "Waiting for database..."
MAX_RETRIES=30
RETRY=0

until echo "SELECT 1;" | npx prisma db execute --url "$DATABASE_URL" --stdin >/dev/null 2>&1
do
  RETRY=$((RETRY + 1))
  if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
    echo "Database is not ready after ${MAX_RETRIES} attempts. Exiting."
    exit 1
  fi
  echo "Database not ready yet (attempt ${RETRY}/${MAX_RETRIES})..."
  sleep 2
done

echo "Database is ready. Applying migrations..."
# Safe additive migrations only (nullable columns / FKs). Existing rows stay intact.
npx prisma migrate deploy

echo "Generating Prisma client..."
npx prisma generate

echo "Starting application..."
exec node dist/main
