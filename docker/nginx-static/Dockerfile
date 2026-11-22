# nginx-static - A minimal static file server based on nginx
# This image is used across MyAEGEE services to serve static files and media

FROM nginx:1.30.7-alpine3.24@sha256:caf4e1e032a20f9c3c5e28fc7f25ffd768ad8677b4975c54193075997b3a97e3

LABEL maintainer="AEGEE <info@aegee.org>"

# Expose port 80
EXPOSE 80

# Use STOPSIGNAL for graceful shutdown
STOPSIGNAL SIGTERM

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
