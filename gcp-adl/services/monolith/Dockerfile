FROM node:20-alpine

WORKDIR /app

# Copy shared libraries
COPY shared /app/shared

# Install shared dependencies
RUN cd /app/shared/state && npm install && npm run build && \
    cd /app/shared/jules && npm install && npm run build && \
    cd /app/shared/gemini && npm install && npm run build && \
    cd /app/shared/github && npm install && npm run build

# Copy service files
COPY services/monolith/package*.json ./
RUN npm ci --only=production

COPY services/monolith/tsconfig.json ./
COPY services/monolith/src ./src

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Run with Probot
CMD ["npm", "start"]
