# Migration Guide: Vagrant to Direct Docker on Ubuntu 24.04

This guide helps you migrate your existing MyAEGEE Vagrant development environment to the new direct Docker setup on Ubuntu 24.04.

## Table of Contents

- [Why Migrate?](#why-migrate)
- [Before You Start](#before-you-start)
- [Migration Process](#migration-process)
- [Verification](#verification)
- [Rollback](#rollback)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Why Migrate?

**Performance Benefits**:

- **Faster startup**: ~50% reduction in startup time (no VM overhead)
- **Lower memory usage**: ~30-40% less RAM consumption
- **Faster hot reload**: File changes detected in <3 seconds (vs 5-10s in Vagrant)
- **Native filesystem performance**: No shared folder overhead

**Simplified Workflow**:

- No virtualization layer (VirtualBox)
- Direct access to Docker containers
- Standard Docker commands work natively
- Easier debugging and monitoring

**When to Migrate**:

- ✅ You're on Ubuntu 24.04 (or willing to upgrade)
- ✅ You have existing Vagrant data you want to preserve
- ✅ You want better performance
- ⚠️ You're comfortable with command-line operations

---

## Before You Start

### Prerequisites

1. **Operating System**: Ubuntu 24.04 LTS (x86_64)

   ```bash
   lsb_release -a
   ```

2. **Disk Space**: At least 20GB free

   ```bash
   df -h /
   ```

3. **Vagrant Working**: Your current Vagrant setup should be functional

   ```bash
   cd ~/path/to/MyAEGEE
   vagrant status
   ```

4. **Backup Your Data**: (Optional but recommended)
   - Export any critical data from your databases
   - Take notes of custom .env configurations

### What Gets Migrated

✅ **Migrated Automatically**:

- PostgreSQL databases (all services: core, events, statutory, etc.)
- Portainer configuration and data
- Environment variables (.env file)

❌ **Not Migrated** (ephemeral data):

- Running container states
- Temporary files and logs
- Node modules (will be reinstalled)

### Safety Guarantees

🛡️ **Non-Destructive Migration**:

- Your Vagrant setup remains completely intact
- All exported data is backed up to `migration-backup-*/`
- You can test and revert at any time
- No data is deleted from Vagrant

---

## Migration Process

### Step 1: Prepare Your System

Install direct Docker environment:

```bash
cd ~/path/to/MyAEGEE
./scripts-ubuntu/bootstrap.sh
```

This will:

- Install Docker Engine 24.0+
- Set up your user in the docker group
- Configure /etc/hosts
- Prepare the environment

**Important**: Log out and log back in after bootstrap completes.

### Step 2: Ensure Vagrant is Running

Your Vagrant VM must be running for migration:

```bash
vagrant up
```

Verify services are accessible:

```bash
vagrant ssh -c "docker ps"
```

You should see your MyAEGEE containers running.

### Step 3: Run the Migration Script

```bash
./scripts-ubuntu/migrate-from-vagrant.sh
```

**What happens**:

1. **Prerequisites Check** (1-2 min)

   - Validates Vagrant is running
   - Checks Docker is ready
   - Creates backup directory

2. **Configuration Backup** (< 1 min)

   - Backs up .env file
   - Preserves Vagrantfile

3. **Database Export** (5-10 min depending on data size)

   - Exports PostgreSQL volumes for: core, events, statutory, discounts, summeruniversity, knowledge
   - Creates compressed tar archives
   - Progress shown for each service

4. **Data Volume Export** (1-2 min)

   - Exports Portainer data
   - Exports other persistent volumes

5. **Volume Import** (5-10 min)

   - Creates Docker volumes in host environment
   - Imports all exported data
   - Verifies import success

6. **Configuration Migration** (< 1 min)
   - Migrates .env settings
   - Sets MYAEGEE_ENVIRONMENT=direct
   - Preserves custom configuration

**Total time**: ~15-25 minutes depending on your data size

### Step 4: Start Direct Docker

```bash
make start
```

This will:

- Start all services using direct Docker (no Vagrant)
- Use the imported data volumes
- Apply your migrated configuration

### Step 5: Verify Everything Works

See [Verification](#verification) section below.

---

## Verification

### Check Services Are Running

```bash
docker ps
```

You should see ~15-20 containers running:

- traefik
- postgres-core, postgres-events, etc.
- oms-core, oms-events, etc.
- mailer
- gsuite-wrapper
- portainer

### Access the Application

Open your browser:

- **Frontend**: http://my.appserver.test
- **Traefik Dashboard**: http://traefik.appserver.test
- **Portainer**: http://portainer.appserver.test

### Verify Your Data

1. **Log in** with your existing credentials
2. **Check your profile** - should show your user data
3. **Browse events** - past events should be visible
4. **Check bodies/circles** - organizational data should be present

### Check Database Connectivity

```bash
# Check core database
docker exec -it postgres-core psql -U postgres -d myaegee-core -c "\dt"

# Should show tables: users, bodies, circles, etc.
```

### Monitor Logs

```bash
make logs
```

Look for:

- ✅ Services starting successfully
- ✅ Database connections established
- ❌ No "connection refused" errors
- ❌ No "table does not exist" errors

### Test Hot Reload

1. Edit a file in `core/lib/`:

   ```bash
   echo "// test change" >> core/lib/server.js
   ```

2. Watch logs:

   ```bash
   make monitor core
   ```

3. Should see restart within 3 seconds

---

## Rollback

If something goes wrong, you can easily revert:

### Option 1: Keep Both (Recommended for Testing)

Use Vagrant and direct Docker side-by-side:

**Use Vagrant**:

```bash
vagrant up
# In Vagrant SSH: make start
```

**Use Direct Docker**:

```bash
vagrant halt
make start
```

### Option 2: Complete Rollback

Remove direct Docker volumes and use only Vagrant:

```bash
# Stop direct Docker
make stop

# Remove imported volumes (WARNING: Deletes direct Docker data)
docker volume rm $(docker volume ls -q | grep myaegee_)

# Use Vagrant exclusively
vagrant up
```

### Restore Original .env

If you want your original Vagrant .env back:

```bash
# Find your backup
ls -lt migration-backup-*/.env.*

# Restore
cp migration-backup-YYYYMMDD-HHMMSS/.env.vagrant .env
```

---

## Troubleshooting

### Migration Script Fails

**"Vagrant is not running"**:

```bash
vagrant up
./scripts-ubuntu/migrate-from-vagrant.sh
```

**"No databases were exported"**:

- Your Vagrant environment may not have data yet
- Continue anyway for fresh installation
- Or populate Vagrant with test data first

**"Permission denied accessing Docker"**:

```bash
# Log out and back in after bootstrap
# Or temporary workaround:
newgrp docker
./scripts-ubuntu/migrate-from-vagrant.sh
```

### Services Won't Start After Migration

**Port conflicts**:

```bash
./scripts-ubuntu/check-port-conflicts.sh --interactive
# Stop conflicting services
sudo systemctl stop apache2 nginx postgresql
make start
```

**Database connection errors**:

```bash
# Check volumes exist
docker volume ls | grep postgres

# Check container logs
docker logs postgres-core
```

**"Table does not exist" errors**:

Database import may have failed. Check:

```bash
# Verify volume has data
docker run --rm -v myaegee_postgres-core:/data busybox ls -lah /data

# Should show PostgreSQL files (base/, global/, pg_wal/, etc.)
```

If empty, re-run migration:

```bash
# Remove failed volume
docker volume rm myaegee_postgres-core

# Re-import
docker run --rm \
  -v myaegee_postgres-core:/target \
  -v /path/to/migration-backup-*/core-postgres.tar:/backup.tar:ro \
  busybox tar xzf /backup.tar -C /target
```

### Performance Issues

**Slow startup**:

- First startup builds images (5-10 min normal)
- Subsequent startups should be <2 min

**Hot reload not working**:

```bash
# Increase inotify limits
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Restart service
make restart core
```

### Data Verification Issues

**Missing user accounts**:

```bash
# Check users table
docker exec -it postgres-core psql -U postgres -d myaegee-core \
  -c "SELECT id, username, email FROM users LIMIT 5;"
```

**Missing events**:

```bash
# Check events table
docker exec -it postgres-events psql -U postgres -d myaegee-events \
  -c "SELECT id, name, starts FROM events ORDER BY starts DESC LIMIT 5;"
```

If data is truly missing, rollback and check Vagrant data integrity.

---

## FAQ

### Do I need to keep Vagrant installed?

**Short term**: Yes, keep it until you're confident the migration worked.

**Long term**: No, you can remove it after 1-2 weeks of successful direct Docker usage.

To remove:

```bash
vagrant destroy  # Delete the VM
sudo apt-get remove vagrant virtualbox
```

### Can I migrate back to Vagrant?

Yes, but with caveats:

- Vagrant setup remains intact during migration
- Data you created in direct Docker won't be in Vagrant
- You'd need to export from direct Docker and import to Vagrant (reverse process)

### Will my teammates need to migrate?

**No**. The migration is per-developer:

- Vagrant setup still works for everyone else
- Each developer migrates when ready
- No changes to repository files (except scripts in scripts-ubuntu/)

### What about CI/CD?

CI/CD environments are unaffected:

- Continue using existing Docker-based CI
- Vagrant was only for local development
- No changes needed to CircleCI, GitHub Actions, etc.

### Can I use both Vagrant and direct Docker?

Yes! But not simultaneously on the same machine:

- Stop one before starting the other (port conflicts)
- Both access the same repository code
- Data volumes are separate

Example workflow:

```bash
# Use direct Docker
make start

# Switch to Vagrant for testing
make stop
vagrant up
vagrant ssh
# Inside VM: make start
```

### How much disk space does the migration need?

- **During migration**: 2x your Vagrant volume size (for exports)
- **After migration**: Same as Vagrant (just in different location)
- **Cleanup**: Delete `migration-backup-*/` after successful verification

Check current Vagrant size:

```bash
vagrant ssh -c "docker system df -v"
```

### What if I have custom Vagrant modifications?

**Vagrantfile customizations**: Won't apply to direct Docker (no VM)

**Port mappings**: Translate to .env configuration:

```ruby
# Vagrant
config.vm.network "forwarded_port", guest: 80, host: 8080

# Direct Docker (.env)
TRAEFIK_HTTP_PORT=8080
```

**Synced folders**: Not needed (working directory is directly accessible)

**Provisioning scripts**: Check if applicable to host system

### Can I test the migration without affecting my current setup?

Yes! The migration is non-destructive:

1. Run migration
2. Test direct Docker thoroughly
3. Keep Vagrant running as backup
4. Switch back anytime with `vagrant up`

### How do I verify the export was successful?

Check backup directory:

```bash
ls -lh migration-backup-*/

# Should see:
# core-postgres.tar (50-500MB depending on data)
# events-postgres.tar
# statutory-postgres.tar
# etc.
```

Verify a tar file has data:

```bash
tar tzf migration-backup-*/core-postgres.tar | head -20

# Should show:
# base/
# global/
# pg_wal/
# etc.
```

---

## Success Checklist

After migration, verify:

- [ ] All services running: `docker ps` shows ~15-20 containers
- [ ] Can access frontend: http://my.appserver.test
- [ ] Can log in with existing credentials
- [ ] User data is present (profile, settings)
- [ ] Events/bodies/circles visible (if you had them)
- [ ] Hot reload works (<3s file change detection)
- [ ] Logs show no errors: `make logs`
- [ ] Backup directory exists: `ls migration-backup-*/`
- [ ] Performance feels good (faster than Vagrant)

---

## Getting Help

If migration fails or you encounter issues:

1. **Check logs**:

   ```bash
   make logs
   docker logs <container-name>
   ```

2. **Verify Vagrant data**:

   ```bash
   vagrant ssh -c "docker ps"
   vagrant ssh -c "docker volume ls"
   ```

3. **Review backup**:

   ```bash
   ls -lh migration-backup-*/
   ```

4. **Get support**:
   - Check: docs/troubleshooting-ubuntu.md
   - Search: GitHub issues
   - Ask: AEGEE-Europe technical community

---

## Post-Migration Cleanup

After successfully using direct Docker for 1-2 weeks:

```bash
# Remove Vagrant VM (frees ~5-10GB)
vagrant destroy

# Remove backup directory (frees ~1-5GB)
rm -rf migration-backup-*

# Optional: Uninstall Vagrant and VirtualBox
sudo apt-get remove vagrant virtualbox
sudo apt-get autoremove
```

**Congratulations! You're now running MyAEGEE with direct Docker on Ubuntu 24.04! 🎉**
