# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Create a non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Copy shared package files
COPY --chown=appuser:appgroup shared/state/package.json ./shared/state/package.json
COPY --chown=appuser:appgroup shared/state/package-lock.json ./shared/state/package-lock.json
COPY --chown=appuser:appgroup shared/jules/package.json ./shared/jules/package.json
COPY --chown=appuser:appgroup shared/jules/package-lock.json ./shared/jules/package-lock.json
COPY --chown=appuser:appgroup shared/gemini/package.json ./shared/gemini/package.json
COPY --chown=appuser:appgroup shared/gemini/package-lock.json ./shared/gemini/package-lock.json
COPY --chown=appuser:appgroup shared/github/package.json ./shared/github/package.json
# shared/github has no package-lock.json

# Copy monolith package files
COPY --chown=appuser:appgroup services/monolith/package.json ./services/monolith/package.json
COPY --chown=appuser:appgroup services/monolith/package-lock.json ./services/monolith/package-lock.json

# Copy source code
COPY --chown=appuser:appgroup shared ./shared
COPY --chown=appuser:appgroup services/monolith ./services/monolith

# Install and build shared
WORKDIR /app
RUN cd shared/state && npm ci && npm run build
RUN cd shared/jules && npm ci && npm run build
RUN cd shared/gemini && npm ci && npm run build
RUN cd shared/github && npm install && npm run build

# Install and build monolith
WORKDIR /app/services/monolith
RUN npm ci
RUN npm run build

# Stage 2: Create the production image
FROM node:20-alpine

WORKDIR /app

# Create a non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Copy shared libs (dist) structure so symlinks work
COPY --from=builder --chown=appuser:appgroup /app/shared/state/dist ./shared/state/dist
COPY --from=builder --chown=appuser:appgroup /app/shared/state/package.json ./shared/state/package.json
COPY --from=builder --chown=appuser:appgroup /app/shared/jules/dist ./shared/jules/dist
COPY --from=builder --chown=appuser:appgroup /app/shared/jules/package.json ./shared/jules/package.json
COPY --from=builder --chown=appuser:appgroup /app/shared/gemini/dist ./shared/gemini/dist
COPY --from=builder --chown=appuser:appgroup /app/shared/gemini/package.json ./shared/gemini/package.json
COPY --from=builder --chown=appuser:appgroup /app/shared/github/dist ./shared/github/dist
COPY --from=builder --chown=appuser:appgroup /app/shared/github/package.json ./shared/github/package.json

# Copy monolith
WORKDIR /app/services/monolith
COPY --from=builder --chown=appuser:appgroup /app/services/monolith/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/services/monolith/package.json ./
COPY --from=builder --chown=appuser:appgroup /app/services/monolith/package-lock.json ./
COPY --from=builder --chown=appuser:appgroup /app/services/monolith/dist ./dist

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Run with Probot
CMD ["npm", "start"]