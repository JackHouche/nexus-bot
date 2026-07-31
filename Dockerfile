FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package.json yarn.lock* package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .

# Build
RUN npm run build

# Start
CMD ["npm", "start"]
