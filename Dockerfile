# Stage 1: Build
FROM node:20 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install deps
RUN npm ci

# Copy prisma folder
COPY prisma ./prisma
COPY prisma.config.ts ./

# Copy source code
COPY . .

# Generate Prisma client
RUN npm run prisma:generate

# Build the app
RUN npm run build

# Stage 2: Run
FROM node:20-alpine

WORKDIR /app

# Copy build output & dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Set production env
ENV NODE_ENV=production
EXPOSE 5056

CMD ["npm", "run", "start:docker"]
