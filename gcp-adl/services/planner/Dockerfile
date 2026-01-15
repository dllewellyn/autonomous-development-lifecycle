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
COPY services/planner/package*.json ./
RUN npm install
RUN npm install -g @google/gemini-cli

COPY services/planner/tsconfig.json ./
COPY services/planner/src ./src

# Build
RUN npm run build

# Run
CMD ["npm", "start"]
