# nginx-static - A minimal static file server based on nginx
# This image is used across MyAEGEE services to serve static files and media

FROM nginx:1.28.1-alpine3.23@sha256:52e3ada4d978443601f286cc2f9e7b95c82aa3ad5a78ce9c6b94ce00258e68cc

LABEL maintainer="AEGEE <info@aegee.org>"

# Expose port 80
EXPOSE 80

# Use STOPSIGNAL for graceful shutdown
STOPSIGNAL SIGTERM

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
