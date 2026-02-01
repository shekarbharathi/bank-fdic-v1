# Frontend Dockerfile for Railway
# This should be used when root directory is set to 'frontend'
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy frontend source
COPY . ./

# Build the application
RUN npm run build

# Verify build output
RUN ls -la dist && ls -la dist/ | head -10

# Production stage with nginx
FROM nginx:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration template
COPY nginx.conf /tmp/nginx.conf.template

# Create startup script that substitutes PORT variable and starts nginx
RUN echo '#!/bin/sh' > /start-nginx.sh && \
    echo 'set -e' >> /start-nginx.sh && \
    echo 'PORT=${PORT:-80}' >> /start-nginx.sh && \
    echo 'export PORT' >> /start-nginx.sh && \
    echo 'echo "Starting nginx on port $PORT"' >> /start-nginx.sh && \
    echo 'sed "s/\${PORT}/$PORT/g" /tmp/nginx.conf.template > /etc/nginx/conf.d/default.conf' >> /start-nginx.sh && \
    echo 'exec nginx -g "daemon off;"' >> /start-nginx.sh && \
    chmod +x /start-nginx.sh

# Expose port (Railway will set PORT env var)
EXPOSE 80

CMD ["/start-nginx.sh"]
