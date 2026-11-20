# nginx-static - A minimal static file server based on nginx
# This image is used across MyAEGEE services to serve static files and media

FROM nginx:1.31.2-alpine3.23@sha256:54f2a904c251d5a34adf545a72d32515a15e08418dae0266e23be2e18c66fefa

LABEL maintainer="AEGEE <info@aegee.org>"

# Expose port 80
EXPOSE 80

# Use STOPSIGNAL for graceful shutdown
STOPSIGNAL SIGTERM

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
