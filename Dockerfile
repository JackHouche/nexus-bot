FROM node:22-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# Expose port (not really needed for a Discord bot, but required by Coolify)
EXPOSE 8080

# Start: run Prisma migrations then start the bot
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]
