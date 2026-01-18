# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Create a non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Copy package.json and package-lock.json for shared libraries and the main service
COPY shared/state/package.json ./shared/state/package.json
COPY shared/state/package-lock.json ./shared/state/package-lock.json
COPY shared/jules/package.json ./shared/jules/package.json
COPY shared/jules/package-lock.json ./shared/jules/package-lock.json
COPY shared/gemini/package.json ./shared/gemini/package.json
COPY shared/gemini/package-lock.json ./shared/gemini/package-lock.json
COPY shared/github/package.json ./shared/github/package.json
COPY shared/github/package-lock.json ./shared/github/package-lock.json
COPY services/monolith/package.json ./package.json
COPY services/monolith/package-lock.json ./package-lock.json

# Install dependencies (including shared)
RUN npm ci

# Copy shared source code
COPY --chown=appuser:appgroup shared/state ./shared/state
COPY --chown=appuser:appgroup shared/jules ./shared/jules
COPY --chown=appuser:appgroup shared/gemini ./shared/gemini
COPY --chown=appuser:appgroup shared/github ./shared/github

# Build shared libraries
RUN cd shared/state && npm run build && \
    cd ../jules && npm run build && \
    cd ../gemini && npm run build && \
    cd ../github && npm run build

# Copy service source code and tsconfig
COPY --chown=appuser:appgroup services/monolith/tsconfig.json ./
COPY --chown=appuser:appgroup services/monolith/src ./src

# Build the main application
RUN npm run build

# Stage 2: Create the production image
FROM node:20-alpine

WORKDIR /app

# Create a non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Copy production dependencies from builder stage
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
COPY --from=builder --chown=appuser:appgroup /app/package-lock.json ./

# Copy built application from builder stage
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

# Copy built shared libraries (only dist)
COPY --from=builder --chown=appuser:appgroup /app/shared/state/dist ./shared/state/dist
COPY --from=builder --chown=appuser:appgroup /app/shared/jules/dist ./shared/jules/dist
COPY --from=builder --chown=appuser:appgroup /app/shared/gemini/dist ./shared/gemini/dist
COPY --from=builder --chown=appuser:appgroup /app/shared/github/dist ./shared/github/dist

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Run with Probot
CMD ["npm", "start"]