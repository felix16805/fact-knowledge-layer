FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Expose Next.js port
EXPOSE 3000

# The command is overridden by docker-compose for app vs worker
CMD ["npm", "run", "dev"]
