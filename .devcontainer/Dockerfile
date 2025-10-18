# Dev Container for MyAEGEE
# Base image: Official Microsoft dev container with Ubuntu 22.04 LTS
FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# ==============================================================================
# LAYER 1: System packages (changes infrequently - good cache layer)
# ==============================================================================
# Install essential development tools
# These packages rarely change, so this layer will be cached effectively
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
        curl \
        wget \
        git \
        ca-certificates \
        gnupg \
        lsb-release \
        build-essential \
        postgresql-client \
        vim \
        nano \
        jq \
        bash-completion \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ==============================================================================
# LAYER 2: Node.js setup (stable LTS version - good cache layer)
# ==============================================================================
# Install Node.js 18.x (LTS)
# Separated from other packages for better caching since Node version is stable
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ==============================================================================
# LAYER 3: Docker CLI (stable version - good cache layer)
# ==============================================================================
# Install Docker CLI (for interacting with host Docker daemon)
# Separated because Docker CLI version is stable and changes infrequently
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli docker-compose-plugin \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ==============================================================================
# LAYER 4: Global npm packages (may change with updates)
# ==============================================================================
# Install global npm packages for development
# Separate layer so changing npm packages doesn't invalidate earlier layers
RUN npm install -g nodemon npm-check-updates

# ==============================================================================
# LAYER 5: User configuration (changes occasionally)
# ==============================================================================
# Set up non-root user (vscode user is already created by base image)
USER vscode

# Configure bash prompt and enable bash completion
RUN echo 'export PS1="\[\033[01;32m\]\u@myaegee\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ "' >> /home/vscode/.bashrc \
    && echo '# Enable bash completion for docker and docker-compose' >> /home/vscode/.bashrc \
    && echo 'if [ -f /usr/share/bash-completion/bash_completion ]; then' >> /home/vscode/.bashrc \
    && echo '    . /usr/share/bash-completion/bash_completion' >> /home/vscode/.bashrc \
    && echo 'fi' >> /home/vscode/.bashrc

# Switch back to root for any remaining setup
USER root

# Ensure vscode user can use Docker socket
RUN usermod -aG docker vscode || true

# Set working directory
WORKDIR /workspace

# Default command
CMD ["/bin/bash"]
