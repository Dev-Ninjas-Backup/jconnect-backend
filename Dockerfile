# Stage 1: Build
FROM node:20 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install deps
RUN npm install --ignore-scripts

# Copy prisma folder
COPY prisma ./prisma
COPY prisma.config.ts ./

# Copy source code
COPY . .

# Generate Prisma client
RUN npm run prisma:generate

# Build the app (increase heap for large TS projects)
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Stage 2: Run
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

# Copy build output & dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

# Set production env
ENV NODE_ENV=production
EXPOSE 5056

# Runs: wait for DB → migrate deploy → generate → start app
CMD ["./docker-entrypoint.sh"]
