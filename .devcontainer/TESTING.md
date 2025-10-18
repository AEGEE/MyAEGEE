# Cross-Platform Testing Checklist

This checklist is for validating the dev container setup across all platforms (T084-T088).

## Testing Overview

**Remaining Tasks**:

- [ ] T084: Windows host validation
- [ ] T085: macOS host validation
- [ ] T086: Linux host validation
- [ ] T087: GitHub Codespaces validation
- [ ] T088: Edge case verification

**Estimated Time**: 2-3 hours per platform + 2 hours for edge cases = ~10-12 hours total

---

## T084: Windows Host Testing

**Prerequisites**:

- Windows 10/11 machine
- Docker Desktop for Windows installed
- VS Code installed
- ~20GB free disk space

### Setup Phase (30 minutes)

- [ ] **Install Prerequisites**

  - [ ] Install Docker Desktop for Windows
  - [ ] Install Visual Studio Code
  - [ ] Install Dev Containers extension (`ms-vscode-remote.remote-containers`)
  - [ ] Verify Docker is running: `docker --version`
  - [ ] Verify minimum 8GB RAM allocated to Docker (Settings → Resources)

- [ ] **Run Prerequisites Validation**

  ```powershell
  # Clone repository
  git clone --recursive https://github.com/AEGEE/MyAEGEE.git
  cd MyAEGEE

  # Run validation script (from Git Bash or WSL)
  bash .devcontainer/scripts/validate-setup.sh
  ```

  - [ ] All checks pass (or warnings only)
  - [ ] Docker version ≥20.10
  - [ ] RAM ≥4GB available
  - [ ] Disk space ≥20GB

### Container Build Phase (10-15 minutes)

- [ ] **Open in VS Code**

  ```powershell
  code .
  ```

  - [ ] VS Code opens successfully
  - [ ] Dev Containers extension shows "Reopen in Container" notification

- [ ] **Build Container**

  - [ ] Click "Reopen in Container" (or Command Palette → "Dev Containers: Reopen in Container")
  - [ ] Build starts without errors
  - [ ] Build completes within 15 minutes
  - [ ] No red error messages in output (warnings OK)

- [ ] **Post-Create Script**
  - [ ] post-create.sh runs automatically
  - [ ] Environment file created: `.env.devcontainer`
  - [ ] Shell aliases created: `.devcontainer/aliases.sh`
  - [ ] Bash completion configured
  - [ ] Log file created: `.devcontainer/logs/post-create-*.log`

### Service Startup Phase (5-10 minutes)

- [ ] **Post-Start Script**

  - [ ] post-start.sh runs automatically
  - [ ] Banner displays "MyAEGEE Dev Container"
  - [ ] RAM check runs (may prompt for minimal mode if <6GB)
  - [ ] Environment detection: "VS Code Dev Containers (Local)"
  - [ ] Port conflict detection runs
  - [ ] Services start via `make start`

- [ ] **Startup Timing**

  - [ ] Startup time displayed at end
  - [ ] Startup time ≤2 minutes (target, SC-004)
  - [ ] Performance assessment shows "Excellent" or "Good"

- [ ] **Service Health Checks**
  - [ ] Health check script runs automatically
  - [ ] All databases marked as healthy
  - [ ] All backend services marked as healthy
  - [ ] Frontend marked as healthy
  - [ ] Status table displays correctly with colors

### Service Access Phase (10 minutes)

- [ ] **Frontend Access**

  - [ ] Open browser: http://localhost:3000
  - [ ] MyAEGEE loads without errors
  - [ ] Login page displays
  - [ ] Can navigate to different sections

- [ ] **API Access**

  - [ ] Core API: http://localhost:8084/healthcheck
    - [ ] Returns JSON: `{"success": true}`
  - [ ] Events API: http://localhost:8085/healthcheck
    - [ ] Returns healthy status
  - [ ] At least 3 other APIs respond correctly

- [ ] **Management Tools**
  - [ ] Traefik: http://localhost:8080
    - [ ] Dashboard loads
    - [ ] Shows all services
  - [ ] Portainer: http://localhost:9000
    - [ ] Loads (may need initial setup)
    - [ ] Shows MyAEGEE containers
  - [ ] pgAdmin: http://localhost:5050
    - [ ] Loads (may need login)

### Development Workflow Phase (15 minutes)

- [ ] **Terminal Integration**

  - [ ] Open integrated terminal in VS Code
  - [ ] Default shell is bash
  - [ ] Shell aliases work: `mstart`, `mstop`, `health`
  - [ ] Docker commands work: `docker ps`
  - [ ] Docker completion works: `docker <TAB>` (type docker then press Tab)

- [ ] **Hot Reload Test**

  - [ ] Open `frontend/src/App.vue` (or any frontend file)
  - [ ] Make a visible change (e.g., change text or color)
  - [ ] Save file
  - [ ] Note current time
  - [ ] Refresh browser at http://localhost:3000
  - [ ] Change visible within 3 seconds (SC-005)
  - [ ] Run validation: `.devcontainer/scripts/validate-performance.sh hot-reload`

- [ ] **Database Reset Test**
  - [ ] Run: `make reset-db-core`
  - [ ] 5-second confirmation prompt appears
  - [ ] Confirm reset
  - [ ] Core database recreated
  - [ ] Service restarts automatically
  - [ ] Can log in with test credentials: `admin@example.com` / `5ecr3t5ecr3t`

### Performance Validation Phase (10 minutes)

- [ ] **Run Performance Tests**
  ```bash
  .devcontainer/scripts/validate-performance.sh --all
  ```
  - [ ] Test 1: Startup Timing - PASS (≤120s)
  - [ ] Test 2: Hot Reload - PASS or SKIP (≤3s)
  - [ ] Test 3: Full Mode Memory - PASS (≤4GB)
  - [ ] Test 4: Minimal Mode Memory - PASS (≤2GB)
  - [ ] Summary shows all tests passed or acceptable warnings

### Minimal Mode Test (10 minutes)

- [ ] **Switch to Minimal Mode**

  ```bash
  # Edit .env file
  nano .env
  # Set: ENABLED_SERVICES=core:frontend
  # Save and exit

  make restart
  ```

  - [ ] Only core and frontend containers running
  - [ ] Other services stopped
  - [ ] Memory usage reduced (~2GB)

- [ ] **Verify Minimal Mode Functionality**

  - [ ] Frontend still accessible at http://localhost:3000
  - [ ] Can log in
  - [ ] Core API functions work
  - [ ] Run: `.devcontainer/scripts/validate-performance.sh minimal-memory`
  - [ ] Memory ≤2GB (PASS)

- [ ] **Switch Back to Full Mode**
  ```bash
  nano .env
  # Set: ENABLED_SERVICES=
  # (empty = all services)
  make restart
  ```
  - [ ] All services start
  - [ ] All APIs accessible

### Windows-Specific Tests (10 minutes)

- [ ] **Line Endings**

  - [ ] Check VS Code status bar shows "LF" (not "CRLF")
  - [ ] Shell scripts execute without `\r: command not found` errors
  - [ ] EditorConfig working (file → bottom right → should show "EditorConfig")

- [ ] **File Permissions**

  - [ ] Can edit files in workspace
  - [ ] Changes save successfully
  - [ ] No permission denied errors

- [ ] **Path Handling**
  - [ ] Scripts execute with Unix paths
  - [ ] No backslash path errors
  - [ ] Navigation aliases work: `cdcore`, `cdevents`

### Cleanup & Restart Test (5 minutes)

- [ ] **Stop Container**

  - [ ] Command Palette → "Dev Containers: Reopen Folder Locally"
  - [ ] Container stops gracefully
  - [ ] No errors in output

- [ ] **Restart Container**
  - [ ] Command Palette → "Dev Containers: Reopen in Container"
  - [ ] Container starts from existing image (faster, ~2 minutes)
  - [ ] Services start automatically via post-start.sh
  - [ ] All services healthy
  - [ ] Database data persists (users still exist)

### Issue Documentation

**Record any issues**:

| Issue | Severity | Description | Workaround | Status |
| ----- | -------- | ----------- | ---------- | ------ |
|       |          |             |            |        |

**Windows-specific notes**:

```
(Add any platform-specific observations here)
```

---

## T085: macOS Host Testing

**Prerequisites**:

- macOS 11 (Big Sur) or later
- Docker Desktop for Mac installed
- VS Code installed

### Setup Phase (30 minutes)

- [ ] **Install Prerequisites**

  - [ ] Install Docker Desktop for Mac
  - [ ] Install Visual Studio Code
  - [ ] Install Dev Containers extension
  - [ ] Verify Docker is running: `docker --version`
  - [ ] Allocate at least 8GB RAM to Docker (Docker Desktop → Settings → Resources)

- [ ] **Run Prerequisites Validation**
  ```bash
  git clone --recursive https://github.com/AEGEE/MyAEGEE.git
  cd MyAEGEE
  bash .devcontainer/scripts/validate-setup.sh
  ```
  - [ ] All checks pass (or warnings only)
  - [ ] Docker version ≥20.10
  - [ ] RAM ≥4GB available

### Container Build & Startup (15-20 minutes)

- [ ] **Build Container** (same steps as Windows)

  - [ ] Open in VS Code: `code .`
  - [ ] Reopen in Container
  - [ ] Build completes within 15 minutes
  - [ ] post-create.sh runs successfully
  - [ ] post-start.sh runs successfully

- [ ] **Service Startup**
  - [ ] All services healthy
  - [ ] Startup time ≤2 minutes
  - [ ] Health checks pass

### Service Access (10 minutes)

- [ ] **All Services Accessible** (same URLs as Windows)
  - [ ] Frontend: http://localhost:3000
  - [ ] Core API: http://localhost:8084/healthcheck
  - [ ] Traefik: http://localhost:8080
  - [ ] Portainer: http://localhost:9000
  - [ ] pgAdmin: http://localhost:5050

### Development Workflow (15 minutes)

- [ ] **Terminal Integration**

  - [ ] Integrated terminal works
  - [ ] Shell aliases available
  - [ ] Docker commands work
  - [ ] Bash completion works

- [ ] **Hot Reload Test**

  - [ ] Edit frontend file
  - [ ] Changes visible within 3 seconds
  - [ ] Run: `.devcontainer/scripts/validate-performance.sh hot-reload`

- [ ] **Database Operations**
  - [ ] `make reset-db-core` works
  - [ ] Database persists across container restarts

### Performance Validation (10 minutes)

- [ ] **Run All Performance Tests**
  ```bash
  .devcontainer/scripts/validate-performance.sh --all
  ```
  - [ ] All tests pass (or acceptable warnings)
  - [ ] Startup timing ≤120s
  - [ ] Hot reload ≤3s
  - [ ] Full mode ≤4GB
  - [ ] Minimal mode ≤2GB

### macOS-Specific Tests (10 minutes)

- [ ] **Apple Silicon (M1/M2/M3) - if applicable**

  - [ ] Docker runs (may use Rosetta 2)
  - [ ] Services start without architecture warnings
  - [ ] Performance is acceptable
  - [ ] No x86_64 emulation errors

- [ ] **File System Performance**

  - [ ] Hot reload is fast (cached volumes)
  - [ ] No excessive file watching warnings
  - [ ] Check: `cat .devcontainer/docker-compose.devcontainer.yml | grep cached`
  - [ ] Should show `:cached` suffix on workspace volume

- [ ] **VirtioFS (if enabled)**
  - [ ] Docker Desktop → Settings → Experimental Features
  - [ ] Check if VirtioFS is enabled
  - [ ] Test file system performance

### Cleanup & Restart (5 minutes)

- [ ] **Stop and restart container**
  - [ ] Reopen Folder Locally
  - [ ] Reopen in Container
  - [ ] Services start automatically
  - [ ] Data persists

### Issue Documentation

**Record any issues**:

| Issue | Severity | Description | Workaround | Status |
| ----- | -------- | ----------- | ---------- | ------ |
|       |          |             |            |        |

**macOS-specific notes**:

```
(Add any platform-specific observations here)

If Apple Silicon:
- Architecture: arm64 / x86_64
- Rosetta 2 used: Yes / No
- Performance impact: None / Minor / Significant
```

---

## T086: Linux Host Testing

**Prerequisites**:

- Linux distribution (Ubuntu 20.04+, Debian 11+, Fedora 35+, etc.)
- Docker Engine 20.10+ or Docker Desktop for Linux
- VS Code installed

### Setup Phase (30 minutes)

- [ ] **Install Prerequisites**

  - [ ] Install Docker Engine:

    ```bash
    # Ubuntu/Debian
    sudo apt-get update
    sudo apt-get install docker.io docker-compose

    # Fedora
    sudo dnf install docker docker-compose

    # Arch
    sudo pacman -S docker docker-compose
    ```

  - [ ] Start Docker daemon:
    ```bash
    sudo systemctl start docker
    sudo systemctl enable docker
    ```
  - [ ] Add user to docker group:
    ```bash
    sudo usermod -aG docker $USER
    # Log out and log back in
    ```
  - [ ] Install VS Code (if not installed)
  - [ ] Install Dev Containers extension

- [ ] **Run Prerequisites Validation**
  ```bash
  git clone --recursive https://github.com/AEGEE/MyAEGEE.git
  cd MyAEGEE
  bash .devcontainer/scripts/validate-setup.sh
  ```
  - [ ] All checks pass
  - [ ] Docker accessible without sudo
  - [ ] RAM ≥4GB available

### Container Build & Startup (15-20 minutes)

- [ ] **Build Container**

  - [ ] Open in VS Code: `code .`
  - [ ] Reopen in Container
  - [ ] Build completes successfully
  - [ ] post-create.sh runs
  - [ ] post-start.sh runs

- [ ] **Service Startup**
  - [ ] All services start
  - [ ] Startup time ≤2 minutes
  - [ ] Health checks pass

### Service Access (10 minutes)

- [ ] **All Services Accessible**
  - [ ] Frontend: http://localhost:3000
  - [ ] APIs: http://localhost:808X
  - [ ] Management tools: http://localhost:8080, :9000, :5050

### Development Workflow (15 minutes)

- [ ] **Terminal & Workflow**
  - [ ] Terminal works
  - [ ] Aliases available
  - [ ] Hot reload works (<3 seconds)
  - [ ] Database reset works

### Performance Validation (10 minutes)

- [ ] **Run All Tests**
  ```bash
  .devcontainer/scripts/validate-performance.sh --all
  ```
  - [ ] All tests pass
  - [ ] Note: Linux typically has best performance (no VM overhead)

### Linux-Specific Tests (10 minutes)

- [ ] **File Permissions**

  - [ ] Check file ownership: `ls -la /workspace`
  - [ ] Files owned by `vscode` user
  - [ ] Can create/edit/delete files
  - [ ] No permission denied errors

- [ ] **Docker Socket Access**

  - [ ] Check socket: `ls -la /var/run/docker.sock`
  - [ ] Socket accessible by vscode user
  - [ ] Docker commands work without sudo

- [ ] **Systemd Integration**

  - [ ] Check if systemd is running: `systemctl --version`
  - [ ] Docker service status: `systemctl status docker`
  - [ ] Services persist across host reboots

- [ ] **SELinux / AppArmor (if applicable)**
  - [ ] Check if SELinux is enabled: `getenforce`
  - [ ] No SELinux/AppArmor blocking Docker operations
  - [ ] Container can access host socket

### Distribution-Specific Tests

**If Ubuntu/Debian**:

- [ ] apt packages installed correctly in container
- [ ] No missing dependencies

**If Fedora/RHEL**:

- [ ] dnf/yum packages work
- [ ] Podman compatibility (if using Podman instead of Docker)

**If Arch Linux**:

- [ ] pacman packages work
- [ ] Rolling release compatibility

### Cleanup & Restart (5 minutes)

- [ ] **Stop and restart container**
  - [ ] Container stops gracefully
  - [ ] Restarts successfully
  - [ ] Data persists

### Issue Documentation

**Record any issues**:

| Issue | Severity | Description | Workaround | Status |
| ----- | -------- | ----------- | ---------- | ------ |
|       |          |             |            |        |

**Linux-specific notes**:

```
Distribution: (e.g., Ubuntu 22.04)
Docker version: (docker --version)
Kernel version: (uname -r)

Special configurations:
- SELinux: Enabled / Disabled / Permissive
- AppArmor: Enabled / Disabled
- Docker Desktop: Yes / No (Docker Engine)

Performance notes:
(Linux typically fastest due to no VM overhead)
```

---

## T087: GitHub Codespaces Testing

**Prerequisites**:

- GitHub account
- Access to AEGEE/MyAEGEE repository
- GitHub Codespaces enabled (free tier available)

### Codespace Creation (10-15 minutes)

- [ ] **Create Codespace**

  - [ ] Go to https://github.com/AEGEE/MyAEGEE
  - [ ] Click green "Code" button
  - [ ] Click "Codespaces" tab
  - [ ] Click "Create codespace on main" (or 001-devcontainer-migration branch)

- [ ] **Prebuild Workflow**

  - [ ] Check if prebuild exists: Repository → Actions → "Codespaces Prebuild"
  - [ ] Prebuild should have run on recent .devcontainer/ changes
  - [ ] Creation uses prebuild (faster, ~3-5 minutes)
  - [ ] If no prebuild: Creation takes ~10-15 minutes (full build)

- [ ] **Codespace Startup**
  - [ ] VS Code opens in browser
  - [ ] Dev container builds/starts
  - [ ] post-create.sh runs (check terminal output)
  - [ ] post-start.sh runs
  - [ ] Environment detection shows "GitHub Codespaces"

### Service Startup (5-10 minutes)

- [ ] **Services Start Automatically**

  - [ ] Banner shows "GitHub Codespaces" environment
  - [ ] Services start via make start
  - [ ] Startup time ≤2 minutes
  - [ ] Health checks run
  - [ ] All services marked healthy

- [ ] **Startup URLs Display**
  - [ ] URLs displayed are GitHub Codespaces URLs (not localhost)
  - [ ] Format: `https://{codespace-name}-{port}.app.github.dev`
  - [ ] URLs are clickable in terminal

### Port Forwarding (10 minutes)

- [ ] **Ports Panel**

  - [ ] Click "PORTS" tab (bottom panel, next to Terminal)
  - [ ] All 13 ports listed:
    - [ ] 3000 - Frontend
    - [ ] 8080 - Traefik
    - [ ] 8084-8092 - APIs
    - [ ] 9000 - Portainer
    - [ ] 5050 - pgAdmin

- [ ] **Port Visibility**

  - [ ] All ports show "Public" visibility
  - [ ] Each port has a label (e.g., "Frontend", "Core API")
  - [ ] Globe icon (🌐) appears next to each port

- [ ] **Access Services**

  - [ ] Click globe icon for port 3000 (Frontend)
  - [ ] MyAEGEE loads in new browser tab
  - [ ] HTTPS URL with valid certificate
  - [ ] Can log in and navigate

- [ ] **API Access**

  - [ ] Click globe for port 8084 (Core API)
  - [ ] Navigate to `/healthcheck`
  - [ ] Returns JSON: `{"success": true}`
  - [ ] Test at least 3 other API ports

- [ ] **Management Tools**
  - [ ] Traefik dashboard loads (port 8080)
  - [ ] Portainer loads (port 9000) - may need initial setup
  - [ ] pgAdmin loads (port 5050) - may need login

### Development Workflow (15 minutes)

- [ ] **VS Code in Browser**

  - [ ] Extensions installed automatically
  - [ ] Terminal works (integrated)
  - [ ] File explorer works
  - [ ] Can edit files

- [ ] **Hot Reload Test**

  - [ ] Open `frontend/src/App.vue`
  - [ ] Make a visible change
  - [ ] Save file
  - [ ] Reload browser tab with frontend
  - [ ] Change visible within 3 seconds
  - [ ] Run: `.devcontainer/scripts/validate-performance.sh hot-reload`

- [ ] **Terminal Commands**
  - [ ] Shell aliases work: `mstart`, `mstop`, `health`
  - [ ] Docker commands work: `docker ps`
  - [ ] Database commands work: `make reset-db-core`
  - [ ] Navigation aliases work: `cdcore`, `cdevents`

### Performance Validation (10 minutes)

- [ ] **Run Performance Tests**
  ```bash
  .devcontainer/scripts/validate-performance.sh --all
  ```
  - [ ] Startup timing test
  - [ ] Hot reload test
  - [ ] Full mode memory test
  - [ ] Minimal mode memory test
  - [ ] Note: May be slower than local due to network latency

### Codespaces-Specific Tests (15 minutes)

- [ ] **Machine Type**

  - [ ] Check current machine: Code → Codespaces → (...) → View Performance
  - [ ] Default is 2-core, 4GB RAM
  - [ ] If needed, change to 4-core: (...) → Change machine type
  - [ ] Test with both 2-core and 4-core if possible

- [ ] **Minimal Mode on 2-core**

  - [ ] 2-core machine has limited RAM
  - [ ] Should auto-suggest minimal mode
  - [ ] Test minimal mode works well on 2-core

- [ ] **Stop and Restart**

  - [ ] Stop Codespace: GitHub.com → Code → Codespaces → (...) → Stop
  - [ ] Wait 30 seconds
  - [ ] Restart: Click on Codespace name
  - [ ] Services start automatically
  - [ ] Database data persists
  - [ ] Takes ~2 minutes to be fully ready

- [ ] **Inactivity Timeout**

  - [ ] Leave Codespace idle for 5 minutes
  - [ ] Check if timeout warning appears (default: 30 minutes)
  - [ ] Codespace should auto-save and stop after 30 min inactive

- [ ] **Prebuild Testing**
  - [ ] If you have repo write access:
    - [ ] Make change to `.devcontainer/Dockerfile`
    - [ ] Commit and push to branch
    - [ ] Check Actions → "Codespaces Prebuild"
    - [ ] Workflow should run automatically
    - [ ] New Codespace should use new prebuild

### Quota Management (5 minutes)

- [ ] **Check Usage**

  - [ ] Go to GitHub → Settings → Billing → Codespaces
  - [ ] Check core-hours used
  - [ ] Free tier: 120 core-hours/month
  - [ ] 2-core machine: 60 hours available
  - [ ] 4-core machine: 30 hours available

- [ ] **Stop When Done**
  - [ ] Always stop Codespace when not using
  - [ ] Quota continues while Codespace is running
  - [ ] Stopped Codespaces don't consume quota

### Connectivity Tests (10 minutes)

- [ ] **Network Stability**

  - [ ] Test with stable WiFi
  - [ ] Test with mobile hotspot (if available)
  - [ ] Check reconnection if network drops
  - [ ] VS Code should reconnect automatically

- [ ] **Desktop VS Code Connection**
  - [ ] Open VS Code desktop app
  - [ ] Command Palette → "Codespaces: Connect to Codespace"
  - [ ] Select your Codespace
  - [ ] Should connect and show remote indicator
  - [ ] Test that development works in desktop client

### Cleanup (5 minutes)

- [ ] **Delete Test Codespace**
  - [ ] GitHub.com → Code → Codespaces
  - [ ] (...) → Delete
  - [ ] Confirm deletion
  - [ ] Frees up storage quota

### Issue Documentation

**Record any issues**:

| Issue | Severity | Description | Workaround | Status |
| ----- | -------- | ----------- | ---------- | ------ |
|       |          |             |            |        |

**Codespaces-specific notes**:

```
Machine type used: 2-core / 4-core / 8-core
Prebuild used: Yes / No
Creation time: ____ minutes
Startup time: ____ seconds

Network conditions:
- Connection: WiFi / Ethernet / Mobile
- Stability: Stable / Occasional drops / Unstable

Performance compared to local:
- Startup: Faster / Same / Slower
- Hot reload: Faster / Same / Slower
- Overall: Better / Same / Worse

Quota impact:
- Session duration: ____ hours
- Core-hours consumed: ____
- Remaining quota: ____
```

---

## T088: Edge Case Verification

This task verifies that all edge cases from the specification are handled correctly.

### Port Conflicts (15 minutes)

**Test**: Services handle port conflicts gracefully

- [ ] **Simulate Port Conflict**

  ```bash
  # On HOST, before starting dev container
  # Start a simple web server on port 3000
  python3 -m http.server 3000
  # Or: npm install -g http-server && http-server -p 3000
  ```

- [ ] **Start Dev Container**

  - [ ] Open in VS Code
  - [ ] Reopen in Container
  - [ ] post-start.sh runs

- [ ] **Verify Detection**

  - [ ] post-start.sh detects port 3000 in use
  - [ ] Warning message displays in terminal
  - [ ] Script continues (doesn't fail)
  - [ ] Other services start normally

- [ ] **Check Handling**

  - [ ] Frontend container may fail to start (expected)
  - [ ] Error message is clear and actionable
  - [ ] Suggests stopping conflicting process
  - [ ] Can stop conflict: `kill <PID>` or `lsof -ti:3000 | xargs kill`

- [ ] **Retry After Fixing**

  - [ ] Stop conflicting service on HOST
  - [ ] In container: `make restart`
  - [ ] Frontend now starts successfully
  - [ ] http://localhost:3000 accessible

- [ ] **Test Multiple Port Conflicts**
  - [ ] Start services on ports 3000, 8080, 8084
  - [ ] Verify all detected
  - [ ] All reported in terminal output

**Expected Behavior**: Port conflicts detected, clear error messages, system doesn't crash

### Vagrant Coexistence (20 minutes)

**Test**: Dev container can coexist with Vagrant setup

- [ ] **Have Both Installed**

  - [ ] Vagrant installed and functional
  - [ ] Docker Desktop installed and functional
  - [ ] Same repository can be used for both

- [ ] **Start Vagrant First**

  ```bash
  # In repository root
  vagrant up
  # Wait for Vagrant to fully start
  ```

  - [ ] Vagrant starts normally
  - [ ] Services accessible at \*.appserver.test
  - [ ] No conflicts

- [ ] **While Vagrant Running, Open Dev Container**

  - [ ] Open new VS Code window
  - [ ] Open same repository
  - [ ] Reopen in Container
  - [ ] Expected: Port conflicts detected
  - [ ] Vagrant using 192.168.168.168:80/443
  - [ ] Dev container trying to use localhost:3000, 8080-8092

- [ ] **Stop Vagrant, Start Dev Container**

  ```bash
  vagrant halt
  ```

  - [ ] Vagrant stops cleanly
  - [ ] In VS Code: Reload Window or Rebuild Container
  - [ ] Dev container starts successfully
  - [ ] No port conflicts
  - [ ] All services accessible at localhost

- [ ] **Alternate Between Setups**
  - [ ] Stop dev container (Reopen Folder Locally)
  - [ ] Start Vagrant: `vagrant up`
  - [ ] Services work in Vagrant
  - [ ] Stop Vagrant: `vagrant halt`
  - [ ] Start dev container (Reopen in Container)
  - [ ] Services work in dev container
  - [ ] Database data separate between setups

**Expected Behavior**: Both setups work independently, clear about conflicts if both running

### Docker Not Running (10 minutes)

**Test**: Clear error when Docker daemon is not accessible

- [ ] **Stop Docker Daemon**

  - [ ] **Windows/Mac**: Quit Docker Desktop
  - [ ] **Linux**: `sudo systemctl stop docker`

- [ ] **Try to Open Dev Container**

  - [ ] In VS Code: Command Palette → "Reopen in Container"
  - [ ] Expected: Clear error message
  - [ ] Message mentions Docker is not running
  - [ ] Instructions to start Docker

- [ ] **Validate Script with Docker Stopped**

  ```bash
  bash .devcontainer/scripts/validate-setup.sh
  ```

  - [ ] Check 2 fails: "Docker daemon not accessible"
  - [ ] Clear error message
  - [ ] Actionable instructions: "Start Docker Desktop" or "sudo systemctl start docker"

- [ ] **Start Docker and Retry**
  - [ ] **Windows/Mac**: Start Docker Desktop
  - [ ] **Linux**: `sudo systemctl start docker`
  - [ ] Wait for Docker to be ready: `docker ps`
  - [ ] Retry: Reopen in Container
  - [ ] Successfully opens this time

**Expected Behavior**: Clear error messages, actionable instructions, no confusing failures

### Network Issues (15 minutes)

**Test**: Graceful handling of network problems

- [ ] **Simulate Slow Network**

  - [ ] During container build
  - [ ] If possible, throttle network or use mobile hotspot with poor signal
  - [ ] Container build should continue (may be slow)
  - [ ] Retry mechanisms work for apt/npm downloads

- [ ] **Disconnect Network Mid-Build** (if testing in Codespaces)

  - [ ] Start Codespace creation
  - [ ] Disconnect internet after 30 seconds
  - [ ] Observe error handling
  - [ ] Reconnect network
  - [ ] Retry creation

- [ ] **Service Startup with Network Issues**

  - [ ] In running container, start services
  - [ ] Temporarily disconnect network
  - [ ] Services may fail to start (expected)
  - [ ] Reconnect network
  - [ ] `make restart` should work

- [ ] **Health Check Timeout Handling**
  - [ ] Simulate: Stop a service manually: `docker stop myaegee_core_1`
  - [ ] Run health check: `health` or `source .devcontainer/scripts/health-check.sh && display_service_status`
  - [ ] Health check times out gracefully (doesn't hang forever)
  - [ ] Marks service as unhealthy
  - [ ] Clear error message

**Expected Behavior**: Network issues handled gracefully, timeouts configured, retry logic works

### Disk Space Issues (15 minutes)

**Test**: Proper handling of insufficient disk space

- [ ] **Check Disk Space Before**

  ```bash
  df -h /var/lib/docker
  docker system df
  ```

  - [ ] Note available space

- [ ] **Validate Setup with Low Disk**

  ```bash
  .devcontainer/scripts/validate-setup.sh
  ```

  - [ ] If <10GB: Warning displayed
  - [ ] If <20GB: Recommendation to clean up
  - [ ] Clear instructions: `docker system prune -af`

- [ ] **Simulate Low Disk** (if possible)

  - [ ] Fill up disk (create large dummy file)
  - [ ] Try to build container
  - [ ] Should fail with clear error
  - [ ] Error mentions disk space

- [ ] **Recovery from Low Disk**

  - [ ] Free up space: `docker system prune -af --volumes`
  - [ ] Check freed space: `docker system df`
  - [ ] Retry container build
  - [ ] Should succeed

- [ ] **Monitor During Heavy Use**
  - [ ] Start all services (full mode)
  - [ ] Reset all databases: `make reset-db`
  - [ ] Monitor disk: `docker system df`
  - [ ] Check if volumes grow significantly
  - [ ] Should stay <10GB for all databases

**Expected Behavior**: Low disk detected early, clear warnings, cleanup instructions provided

### Multiple Codespaces (10 minutes)

**Test**: Multiple Codespaces can run simultaneously and are isolated

- [ ] **Create Second Codespace**

  - [ ] While first Codespace is running
  - [ ] Create another Codespace (same branch or different)
  - [ ] Both should be accessible

- [ ] **Verify Isolation**

  - [ ] Each Codespace has unique URL
  - [ ] Frontend URLs: `https://<codespace1>-3000...` and `https://<codespace2>-3000...`
  - [ ] Services in Codespace 1 don't affect Codespace 2
  - [ ] Databases are separate

- [ ] **Test Database Isolation**

  - [ ] In Codespace 1: Create a test user
  - [ ] In Codespace 2: Test user doesn't exist
  - [ ] Reset DB in Codespace 1: `make reset-db-core`
  - [ ] Codespace 2 database unaffected

- [ ] **Resource Monitoring**

  - [ ] Check quota usage with 2 Codespaces
  - [ ] Both consume core-hours
  - [ ] Performance acceptable with both running

- [ ] **Stop One Codespace**
  - [ ] Stop Codespace 1
  - [ ] Codespace 2 continues working
  - [ ] No interference

**Expected Behavior**: Multiple Codespaces fully isolated, no conflicts, quota additive

### Memory Pressure Scenarios (15 minutes)

**Test**: System behavior under memory constraints

- [ ] **Test with 4GB RAM Allocation**

  - [ ] Docker Desktop: Set Memory to 4GB (minimum)
  - [ ] Restart Docker
  - [ ] Start dev container
  - [ ] Interactive prompt should appear suggesting minimal mode
  - [ ] Accept minimal mode: Press Y
  - [ ] Only core+frontend start
  - [ ] System stable

- [ ] **Test RAM Check Thresholds**

  - [ ] Check post-start.sh RAM detection
  - [ ] <4GB: Should error and exit
  - [ ] 4-6GB: Should warn and prompt for minimal mode
  - [ ] > 6GB: Should proceed normally

- [ ] **Force Full Mode on Low RAM**

  - [ ] Set RAM to 4-5GB
  - [ ] Edit .env: `ENABLED_SERVICES=` (empty = all services)
  - [ ] `make start`
  - [ ] All services start (may be slow)
  - [ ] Monitor: `docker stats`
  - [ ] May hit memory limit, some services unhealthy
  - [ ] Expected behavior: System works but warns about performance

- [ ] **Minimal Mode Performance**
  - [ ] Run with ENABLED_SERVICES=core:frontend
  - [ ] Monitor RAM: `free -g`
  - [ ] Should use <2GB
  - [ ] Run: `.devcontainer/scripts/validate-performance.sh minimal-memory`
  - [ ] Should PASS

**Expected Behavior**: RAM limits detected, helpful prompts, minimal mode provides escape hatch

### Unusual Configurations (10 minutes)

**Test**: Edge cases in configuration

- [ ] **Empty ENABLED_SERVICES**

  - [ ] .env: `ENABLED_SERVICES=`
  - [ ] `make start`
  - [ ] All 12 services start (default behavior)

- [ ] **Invalid Service Name**

  - [ ] .env: `ENABLED_SERVICES=core:frontend:nonexistent`
  - [ ] `make start`
  - [ ] Valid services start
  - [ ] Warning about nonexistent service (or silent skip)

- [ ] **Single Service**

  - [ ] .env: `ENABLED_SERVICES=core`
  - [ ] `make start`
  - [ ] Only core and its database start
  - [ ] Other services stopped

- [ ] **Unusual Seed Profile**
  - [ ] .env: `SEED_PROFILE=nonexistent`
  - [ ] `make reset-db-core`
  - [ ] Defaults to standard seed or shows error
  - [ ] Doesn't crash

**Expected Behavior**: Graceful handling of invalid configs, sensible defaults, clear error messages

---

## Summary Checklist

After completing all tests above, verify:

### Documentation Accuracy

- [ ] **Setup guides match reality**

  - [ ] All commands in docs work as written
  - [ ] Prerequisites list is accurate
  - [ ] Timing estimates are reasonable
  - [ ] URLs are correct

- [ ] **Troubleshooting guide covers real issues**
  - [ ] Issues encountered during testing are documented
  - [ ] Solutions in guide actually work
  - [ ] No missing common problems

### Cross-Platform Consistency

- [ ] **Same user experience across platforms**

  - [ ] Windows, macOS, Linux all work similarly
  - [ ] Commands are consistent
  - [ ] Only platform-specific differences are documented

- [ ] **Codespaces equivalent to local**
  - [ ] All features work in Codespaces
  - [ ] Performance is acceptable
  - [ ] Only differences are URL format

### Performance Targets Met

- [ ] **SC-004**: Services healthy <2 minutes ✅
- [ ] **SC-005**: Hot reload <3 seconds ✅
- [ ] **SC-009**: <4GB full mode, <2GB minimal mode ✅
- [ ] **FR-014**: Vagrant coexistence works ✅
- [ ] **FR-015**: Codespaces fully functional ✅

### All Edge Cases Handled

- [ ] Port conflicts detected and reported
- [ ] Vagrant coexistence works
- [ ] Docker not running has clear error
- [ ] Network issues handled gracefully
- [ ] Low disk space detected early
- [ ] Multiple Codespaces are isolated
- [ ] Memory pressure handled (minimal mode)
- [ ] Invalid configs don't crash system

### Final Sign-Off

- [ ] All platform tests complete (T084-T087)
- [ ] All edge cases verified (T088)
- [ ] No critical issues blocking release
- [ ] Documentation updated with findings
- [ ] Ready for production use

---

## Issue Tracking Template

For any issues found during testing, document using this template:

```markdown
### Issue: [Brief Description]

**Task**: T084/T085/T086/T087/T088
**Platform**: Windows / macOS / Linux / Codespaces
**Severity**: Critical / High / Medium / Low

**Description**:
[Detailed description of the issue]

**Steps to Reproduce**:

1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happens]

**Workaround** (if any):
[How to work around the issue]

**Fix Required**:
[What needs to be changed]

**Status**: Open / In Progress / Resolved

**Resolution** (when resolved):
[How it was fixed]
```

---

## Time Estimates

| Task      | Platform   | Estimated Time  |
| --------- | ---------- | --------------- |
| T084      | Windows    | 2-3 hours       |
| T085      | macOS      | 2-3 hours       |
| T086      | Linux      | 2-3 hours       |
| T087      | Codespaces | 2-3 hours       |
| T088      | Edge Cases | 2 hours         |
| **Total** |            | **10-14 hours** |

**Note**: Times assume smooth testing. Add buffer for issue investigation and documentation.

---

**Testing Team**: Please check off items as you complete them and note any issues in the tracking template above.

**Questions?** See `docs/troubleshooting-devcontainer.md` or create an issue.
