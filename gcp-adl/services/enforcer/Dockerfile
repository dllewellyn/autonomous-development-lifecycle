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
COPY services/enforcer/package*.json ./
RUN npm install

COPY services/enforcer/tsconfig.json ./
COPY services/enforcer/src ./src

# Build
RUN npm run build

# Run
CMD ["npm", "start"]
