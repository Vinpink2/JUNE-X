FROM node:lts-slim

# Install only essential dependencies, clean up in same layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    imagemagick \
    webp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install only production dependencies and clean cache
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512"

# Use non-root user for security
USER node

# Run command
CMD ["npm", "run", "start"]
