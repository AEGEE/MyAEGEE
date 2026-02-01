# nginx-static - A minimal static file server based on nginx
# This image is used across MyAEGEE services to serve static files and media

FROM nginx:1.28.1-alpine3.23

LABEL maintainer="AEGEE <info@aegee.org>"

# Install curl for healthchecks
# hadolint ignore=DL3018
RUN apk add --no-cache curl

# Expose port 80
EXPOSE 80

# Use STOPSIGNAL for graceful shutdown
STOPSIGNAL SIGTERM

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
