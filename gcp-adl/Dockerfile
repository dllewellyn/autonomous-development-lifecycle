FROM node:20-slim

WORKDIR /app

# Copy application sources
COPY . .

# Install dependencies and build all packages
# We keep NODE_ENV as default (development) to ensure devDependencies (TypeScript) are installed
RUN npm run build

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
