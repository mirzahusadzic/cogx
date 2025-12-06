---
type: operational
overlay: O5_Operational
status: complete
---

# Appendix A: Troubleshooting Guide

> **"Every error is a teacher. Every solution is wisdom."**

This comprehensive troubleshooting guide covers common issues, error messages, and recovery procedures for the cognition-cli system. Use this reference to diagnose and resolve problems quickly.

**Organization**:

1. [Installation Issues](#installation-issues)
2. [PGC Initialization & Corruption](#pgc-initialization--corruption)
3. [Workbench Connectivity](#workbench-connectivity)
4. [Performance Problems](#performance-problems)
5. [Query & Overlay Issues](#query--overlay-issues)
6. [LanceDB & Embedding Errors](#lancedb--embedding-errors)
7. [Coherence & Alignment Issues](#coherence--alignment-issues)
8. [Common Error Messages](#common-error-messages)
9. [Recovery Procedures](#recovery-procedures)
10. [Getting Help](#getting-help)

---

## Installation Issues

### Problem: `npm install -g cognition-cli` fails

**Symptoms**:

```bash
npm ERR! code EACCES
npm ERR! syscall access
npm ERR! path /usr/local/lib/node_modules
npm ERR! errno -13
npm ERR! Error: EACCES: permission denied
```

**Causes**:

- Insufficient permissions for global npm install
- npm installed with sudo (owned by root)

**Solutions**:

**Option 1: Use npx (no installation)**

```bash
# Run without installing
npx cognition-cli --version
npx cognition-cli wizard
```

**Option 2: Fix npm permissions**

```bash
# Create npm directory in home folder
mkdir ~/.npm-global

# Configure npm to use new directory
npm config set prefix '~/.npm-global'

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH=~/.npm-global/bin:$PATH

# Reload shell config
source ~/.bashrc  # or source ~/.zshrc

# Now install globally
npm install -g cognition-cli
```

**Option 3: Use nvm (Node Version Manager)**

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js via nvm
nvm install 18
nvm use 18

# Now npm install works without sudo
npm install -g cognition-cli
```

---

### Problem: Node.js version too old

**Symptoms**:

```bash
error cognition-cli@2.6.0: The engine "node" is incompatible with this module.
Expected version ">=20.18.1". Got "18.x.x"
```

**Cause**: cognition-cli requires Node.js 20.18.1+ (LTS)

**Solution**:

```bash
# Check current version
node --version

# Option 1: Update via nvm
nvm install 20
nvm use 20
nvm alias default 20

# Option 2: Update via package manager
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS (Homebrew)
brew install node@20
brew link --overwrite node@20

# Verify
node --version  # Should show 20.x.x (>= 20.18.1)
```

---

### Problem: Command not found after install

**Symptoms**:

```bash
$ cognition-cli --version
-bash: cognition-cli: command not found
```

**Causes**:

- npm bin directory not in PATH
- Installation failed silently

**Solutions**:

```bash
# Check if installed
npm list -g cognition-cli

# If installed, find bin path
npm bin -g
# Example output: /home/user/.npm-global/bin

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$(npm bin -g):$PATH"

# Reload shell
source ~/.bashrc

# Verify
cognition-cli --version
```

---

## PGC Initialization & Corruption

### Problem: "PGC not initialized"

**Symptoms**:

```bash
$ cognition-cli status
Error: PGC not initialized in /path/to/project
Run 'cognition-cli init' to initialize.
```

**Cause**: `.open_cognition/` directory does not exist

**Solutions**:

**Option 1: Run wizard (recommended)**

```bash
cognition-cli wizard
# Interactive setup with guided prompts
```

**Option 2: Manual initialization**

```bash
# Initialize PGC
cognition-cli init

# Run genesis on source code
cognition-cli genesis src/

# Generate overlays
cognition-cli overlay generate mission_concepts
cognition-cli overlay generate security_guidelines
```

**Verification**:

```bash
# Check PGC exists
ls -la .open_cognition/

# Expected structure:
# .open_cognition/
# ├── pgc.manifest.yaml
# ├── lancedb/
# ├── overlays/
# └── workflow_log.jsonl
```

---

### Problem: PGC corruption (broken manifest)

**Symptoms**:

```bash
$ cognition-cli status
Error: Failed to parse PGC manifest
YAMLException: Unexpected token at line 12
```

**Cause**: `.open_cognition/pgc.manifest.yaml` is malformed

**Solutions**:

**Option 1: Restore from backup**

```bash
# Check for backups
ls .open_cognition/backups/

# Restore manifest
cp .open_cognition/backups/pgc.manifest.yaml.2025-11-15 \
   .open_cognition/pgc.manifest.yaml

# Verify
cognition-cli status
```

**Option 2: Rebuild manifest**

```bash
# Backup corrupted manifest
mv .open_cognition/pgc.manifest.yaml \
   .open_cognition/pgc.manifest.yaml.corrupted

# Reinitialize
cognition-cli init

# Regenerate all overlays
cognition-cli genesis src/
cognition-cli overlay generate --all

# Verify
cognition-cli status
```

**Prevention**:

```bash
# Enable automatic backups (in .cogxrc.yml)
pgc:
  backup:
    enabled: true
    interval: daily
    retention: 7  # Keep 7 days of backups
```

---

### Problem: LanceDB corruption

**Symptoms**:

```bash
$ cognition-cli ask "what is PGC"
Error: LanceDB query failed
File /path/to/.open_cognition/lancedb/vectors.lance is corrupted
```

**Cause**: LanceDB files damaged (power loss, disk errors)

**Solutions**:

**Option 1: Rebuild LanceDB from overlays**

```bash
# Remove corrupted LanceDB
rm -rf .open_cognition/lancedb/

# Reinitialize (preserves overlays)
cognition-cli init

# Regenerate embeddings
cognition-cli genesis src/
cognition-cli overlay generate --all

# Verify
cognition-cli ask "test query"
```

**Option 2: Complete reset (nuclear option)**

```bash
# Backup overlays
cp -r .open_cognition/overlays /tmp/overlays-backup

# Remove PGC
rm -rf .open_cognition/

# Reinitialize
cognition-cli wizard

# Restore overlays (if compatible)
cp -r /tmp/overlays-backup/* .open_cognition/overlays/

# Regenerate embeddings
cognition-cli genesis src/
```

---

## Workbench Connectivity

### Problem: "Workbench not running"

**Symptoms**:

```bash
$ cognition-cli wizard
Error: Cannot connect to eGemma workbench at http://localhost:8000
Is the workbench running?
```

**Causes**:

- Docker container not started
- Wrong port configuration
- Network issues

**Solutions**:

**Step 1: Check Docker status**

```bash
# Check if Docker is running
docker ps

# If empty, workbench is not running
```

**Step 2: Start workbench**

```bash
# Start workbench
docker compose up -d

# Check logs
docker compose logs -f

# Expected output:
# workbench | INFO: Application startup complete.
# workbench | INFO: Uvicorn running on http://0.0.0.0:8000
```

**Step 3: Verify connectivity**

```bash
# Test health endpoint
curl http://localhost:8000/health

# Expected: {"status":"ok"}
```

**Step 4: Check port conflicts**

```bash
# If health check fails, check if port 8000 is in use
lsof -i :8000

# If another process is using 8000, change workbench port
# In docker-compose.yml:
services:
  workbench:
    ports:
      - "8001:8000"  # Use 8001 externally

# Update config in .cogxrc.yml
workbench:
  url: http://localhost:8001

# Restart
docker compose down
docker compose up -d
```

---

### Problem: "Connection timeout" or "ECONNREFUSED"

**Symptoms**:

```bash
$ cognition-cli ask "test"
Error: connect ECONNREFUSED 127.0.0.1:8000
```

**Causes**:

- Workbench crashed
- Firewall blocking
- Docker networking issues

**Solutions**:

**Step 1: Check workbench logs**

```bash
docker compose logs workbench | tail -50

# Look for errors:
# - Out of memory
# - Segmentation fault
# - Permission denied
```

**Step 2: Restart workbench**

```bash
# Restart container
docker compose restart workbench

# If restart fails, rebuild
docker compose down
docker compose up --build -d
```

**Step 3: Check firewall**

```bash
# Allow Docker bridge network
sudo ufw allow from 172.17.0.0/16

# Or disable firewall temporarily
sudo ufw disable
cognition-cli wizard  # Test
sudo ufw enable
```

**Step 4: Check Docker network**

```bash
# List networks
docker network ls

# Inspect cognition-cli network
docker network inspect cogx_default

# If network issues, recreate
docker compose down
docker network prune
docker compose up -d
```

---

### Problem: Workbench out of memory

**Symptoms**:

```bash
$ docker compose logs workbench
workbench | Killed
workbench exited with code 137
```

**Cause**: Workbench container ran out of memory (exit code 137)

**Solutions**:

**Option 1: Increase Docker memory limit**

```yaml
# docker-compose.yml
services:
  workbench:
    image: egemma/workbench:latest
    mem_limit: 8g # Increase from 4g to 8g
    memswap_limit: 8g
    ports:
      - '8000:8000'
```

**Option 2: Reduce batch size**

```yaml
# .cogxrc.yml
workbench:
  batch_size: 16 # Reduce from 32
  max_concurrent: 2 # Reduce from 4
```

**Option 3: Use smaller models**

```yaml
# .cogxrc.yml
embeddings:
  model: egemma-384 # Instead of egemma-768
```

---

## Performance Problems

### Problem: `genesis` takes too long (> 30 minutes)

**Symptoms**:

```bash
$ cognition-cli genesis src/
Analyzing files: [=========>........] 45% (234/520) ETA: 27m
```

**Causes**:

- Large codebase (> 1000 files)
- Slow embedding generation
- Insufficient memory

**Solutions**:

**Option 1: Increase concurrency**

```yaml
# .cogxrc.yml
performance:
  max_concurrent_files: 8 # Increase from 4
  batch_size: 32 # Increase from 16
```

**Option 2: Exclude unnecessary files**

```yaml
# .cogxignore
node_modules/
dist/
build/
coverage/
*.test.ts
*.spec.ts
```

**Option 3: Use incremental mode**

```bash
# First run: Full genesis (slow)
cognition-cli genesis src/

# Subsequent runs: Use update (fast)
cognition-cli update  # Only processes changed files
```

**Option 4: Increase Node.js heap**

```bash
# For large codebases (> 500 files)
NODE_OPTIONS=--max-old-space-size=8192 cognition-cli genesis src/
```

---

### Problem: Queries very slow (> 10 seconds)

**Symptoms**:

```bash
$ time cognition-cli ask "what is PGC"
[...output...]
real    0m47.521s  # Too slow!
```

**Causes**:

- Large overlay collections (> 10,000 items)
- Slow embeddings
- Network latency to workbench

**Solutions**:

**Option 1: Limit query scope**

```bash
# Instead of querying all overlays
cognition-cli ask "what is PGC"

# Query specific overlay
cognition-cli ask "what is PGC" --overlay mission_concepts

# Limit results
cognition-cli ask "what is PGC" --limit 5
```

**Option 2: Use cached embeddings**

```yaml
# .cogxrc.yml
embeddings:
  cache:
    enabled: true
    ttl: 3600 # 1 hour
```

**Option 3: Compact LanceDB**

```bash
# Reduce database fragmentation
cognition-cli migrate-to-lance --compact

# Check size before/after
du -sh .open_cognition/lancedb/
```

**Option 4: Use local workbench**

```yaml
# .cogxrc.yml
workbench:
  url: http://localhost:8000 # Not remote server
```

---

### Problem: High memory usage during `update`

**Symptoms**:

```bash
$ cognition-cli update
<--- Last few GCs --->
[12345:0x5] JavaScript heap out of memory
```

**Cause**: Too many files changed, Node.js heap exceeded

**Solutions**:

**Option 1: Increase heap size**

```bash
NODE_OPTIONS=--max-old-space-size=8192 cognition-cli update
```

**Option 2: Update in batches**

```bash
# Instead of updating all files
cognition-cli update

# Update specific directories
cognition-cli update src/core/
cognition-cli update src/commands/
```

**Option 3: Clear old overlays**

```bash
# Remove unused overlays
cognition-cli overlay remove old-overlay-name

# Compact database
cognition-cli migrate-to-lance --compact
```

---

## Query & Overlay Issues

### Problem: "No results from queries"

**Symptoms**:

```bash
$ cognition-cli ask "what is PGC"
No results found.
```

**Causes**:

- Overlays not generated
- Empty overlays
- Query too specific

**Solutions**:

**Step 1: Check overlays exist**

```bash
# List all overlays
cognition-cli overlay list

# Expected output:
# - mission_concepts (234 items)
# - security_guidelines (67 items)
# - ...

# If empty or missing:
cognition-cli overlay generate --all
```

**Step 2: Verify overlay content**

```bash
# Check specific overlay
ls -lh .open_cognition/overlays/mission_concepts/

# Should show YAML files:
# -rw-r--r-- concept-001.yaml
# -rw-r--r-- concept-002.yaml
```

**Step 3: Try broader query**

```bash
# Instead of specific
cognition-cli ask "what is the PGC module"

# Try broader
cognition-cli ask "PGC"
cognition-cli ask "grounded context"
```

**Step 4: Check embeddings**

```bash
# Verify LanceDB has vectors
du -sh .open_cognition/lancedb/
# Should show non-zero size (> 1MB)

# If empty, regenerate
cognition-cli genesis src/
```

---

### Problem: Lattice query returns empty set

**Symptoms**:

```bash
$ cognition-cli lattice "O1 - O2"
Code Symbols NOT Covered by Security:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total: 0 uncovered symbols  # Expected to find some
```

**Causes**:

- O₁ or O₂ overlays empty
- All symbols actually covered (rare)
- Overlay mismatch

**Solutions**:

**Step 1: Verify overlays populated**

```bash
# Check O₁ (Structure)
cognition-cli overlay list | grep structure

# Check O₂ (Security)
cognition-cli overlay list | grep security

# If missing, generate
cognition-cli genesis src/  # Generates O₁
cognition-cli overlay generate security_guidelines  # Generates O₂
```

**Step 2: Inspect overlay content**

```bash
# Check O₁ has symbols
ls .open_cognition/overlays/structure/

# Check O₂ has security items
ls .open_cognition/overlays/security_guidelines/
```

**Step 3: Try different query**

```bash
# Try union instead of difference
cognition-cli lattice "O1 + O2"  # Should show all items

# Try intersection
cognition-cli lattice "O1 & O2"  # Should show covered items
```

---

### Problem: "Overlay generation failed"

**Symptoms**:

```bash
$ cognition-cli overlay generate mission_concepts
Error: Failed to generate mission_concepts overlay
No mission documents found in documentation/
```

**Causes**:

- Missing documentation files
- Wrong document type classification
- Parsing errors

**Solutions**:

**Step 1: Check documentation exists**

```bash
# List documentation
ls -lah docs/

# cognition-cli expects:
# - docs/VISION.md (mission)
# - docs/README.md (mission)
# - docs/SECURITY.md (security)
```

**Step 2: Run genesis:docs**

```bash
# Ingest documentation first
cognition-cli genesis:docs docs/

# Then generate overlays
cognition-cli overlay generate mission_concepts
```

**Step 3: Check document classification**

```bash
# View overlay generation with verbose logging
DEBUG=cognition:* cognition-cli overlay generate mission_concepts

# Check logs for:
# "Classified docs/VISION.md as type: mission"
```

**Step 4: Manual verification**

```bash
# Check if overlays were created
ls .open_cognition/overlays/mission_concepts/

# If empty, check file format
# Ensure YAML frontmatter:
cat docs/VISION.md | head -10

# Should have:
# ---
# type: strategic
# overlay: O4_Mission
# ---
```

---

## LanceDB & Embedding Errors

### Problem: "LanceDB query failed"

**Symptoms**:

```bash
$ cognition-cli ask "test"
Error: LanceDB query failed: Table 'mission_concepts' does not exist
```

**Cause**: LanceDB tables not created

**Solutions**:

```bash
# Reinitialize LanceDB
rm -rf .open_cognition/lancedb/

# Regenerate
cognition-cli genesis src/
cognition-cli genesis:docs docs/
cognition-cli overlay generate --all

# Verify tables exist
ls .open_cognition/lancedb/

# Expected:
# mission_concepts.lance
# security_guidelines.lance
# structure.lance
```

---

### Problem: "Embedding generation timeout"

**Symptoms**:

```bash
$ cognition-cli genesis src/
Error: Embedding timeout after 30000ms
Failed to generate embeddings for src/core/pgc.ts
```

**Causes**:

- Workbench overloaded
- File too large (> 10,000 lines)
- Network issues

**Solutions**:

**Option 1: Increase timeout**

```yaml
# .cogxrc.yml
workbench:
  timeout: 60000 # Increase from 30s to 60s
```

**Option 2: Reduce batch size**

```yaml
# .cogxrc.yml
workbench:
  batch_size: 8 # Reduce from 16
  max_concurrent: 2 # Reduce from 4
```

**Option 3: Split large files**

```bash
# If file is > 10,000 lines, consider refactoring
wc -l src/core/pgc.ts
# 12,453 src/core/pgc.ts  # Too large!

# Split into modules:
# - src/core/pgc/index.ts
# - src/core/pgc/manager.ts
# - src/core/pgc/storage.ts
```

**Option 4: Retry with exponential backoff**

```yaml
# .cogxrc.yml (automatic retry)
workbench:
  retry:
    enabled: true
    max_attempts: 3
    backoff: exponential
```

---

### Problem: "Rate limit exceeded (429)"

**Symptoms**:

```bash
$ cognition-cli genesis src/
Error: Rate limit exceeded (429 Too Many Requests)
Retry after: 60 seconds
```

**Cause**: Too many requests to workbench API

**Solutions**:

**Option 1: Wait and retry**

```bash
# Wait 60 seconds
sleep 60

# Retry
cognition-cli genesis src/
```

**Option 2: Reduce concurrency**

```yaml
# .cogxrc.yml
workbench:
  max_concurrent: 1 # Serialize requests
  rate_limit:
    requests_per_minute: 30 # Limit to 30/min
```

**Option 3: Use local workbench**

```bash
# Self-hosted workbench has no rate limits
docker compose up -d

# Update config
workbench:
  url: http://localhost:8000  # Not remote API
```

---

## Coherence & Alignment Issues

### Problem: Coherence score always 0.0

**Symptoms**:

```bash
$ cognition-cli coherence check
Coherence Score: 0.000
Status: ⚠️ INCOHERENT
```

**Causes**:

- O₇ (Coherence) overlay not generated
- No mission concepts in O₄
- Embeddings missing

**Solutions**:

**Step 1: Generate O₄ (Mission)**

```bash
# Ingest mission documentation
cognition-cli genesis:docs docs/

# Generate mission concepts
cognition-cli overlay generate mission_concepts
```

**Step 2: Generate O₇ (Coherence)**

```bash
# Coherence overlay requires O₁ and O₄
cognition-cli genesis src/  # O₁
cognition-cli overlay generate coherence  # O₇

# Verify
cognition-cli coherence check
# Should show score > 0
```

**Step 3: Check mission concepts exist**

```bash
# List mission concepts
cognition-cli concepts top 20

# Should show concepts with weights
# If empty, add mission documentation
```

---

### Problem: "Negative coherence delta" warnings

**Symptoms**:

```bash
$ cognition-cli update
⚠️ Warning: Coherence decreased by -0.03
Previous: 0.85 → Current: 0.82
Possible mission drift detected.
```

**Cause**: Recent changes misaligned with mission

**Solutions**:

**Step 1: Identify drift source**

```bash
# Check recent commits
git log -5 --oneline

# Check what changed
git diff HEAD~1
```

**Step 2: Analyze misaligned code**

```bash
# Find low-coherence symbols
cognition-cli coherence aligned --limit 10 --threshold 0.0

# Should show recently changed symbols at bottom
```

**Step 3: Fix alignment**

```bash
# Option 1: Add mission-aligned documentation
# In src/problematic-file.ts, add comments referencing mission concepts:

/**
 * MISSION ALIGNMENT:
 * - Supports [mission-concept-1]
 * - Implements [mission-concept-2]
 */

# Option 2: Update mission concepts
# If new concepts introduced, document in docs/VISION.md

# Regenerate overlays
cognition-cli update

# Verify alignment improved
cognition-cli coherence check
```

---

## Common Error Messages

### Error: "YAML parse error at line X"

**Full Message**:

```
Error: Failed to parse YAML
YAMLException: Unexpected token 'foo' at line 12, column 5
```

**Cause**: Invalid YAML syntax in manifest or overlay

**Solution**:

```bash
# Find corrupted file
grep -r "foo" .open_cognition/

# Validate YAML
cat .open_cognition/pgc.manifest.yaml | yaml-lint

# Fix syntax errors or restore from backup
```

---

### Error: "ENOSPC: no space left on device"

**Full Message**:

```
Error: ENOSPC: no space left on device, write
```

**Cause**: Disk full

**Solutions**:

```bash
# Check disk usage
df -h

# If /home partition full, clean up:
# 1. Remove old Docker images
docker system prune -a

# 2. Compact LanceDB
cognition-cli migrate-to-lance --compact

# 3. Remove old backups
rm -rf .open_cognition/backups/*

# 4. Clean npm cache
npm cache clean --force
```

---

### Error: "Maximum call stack size exceeded"

**Full Message**:

```
RangeError: Maximum call stack size exceeded
at Object.exports.parse
```

**Cause**: Circular dependency or infinite recursion

**Solutions**:

```bash
# Increase stack size
NODE_OPTIONS=--stack-size=4096 cognition-cli genesis src/

# If still fails, check for circular imports
madge --circular src/

# Fix circular dependencies
```

---

### Error: "Cannot find module 'X'"

**Full Message**:

```
Error: Cannot find module '@cognition/core'
```

**Cause**: Missing dependency

**Solutions**:

```bash
# Reinstall dependencies
npm install

# If global install, reinstall cognition-cli
npm install -g cognition-cli --force

# Verify
cognition-cli --version
```

---

## Recovery Procedures

### Nuclear Reset (Complete PGC Rebuild)

**When to use**: Catastrophic corruption, all else failed

**Steps**:

```bash
# 1. Backup overlays (if salvageable)
tar -czf pgc-backup-$(date +%Y%m%d).tar.gz .open_cognition/overlays/

# 2. Remove PGC
rm -rf .open_cognition/

# 3. Reinitialize
cognition-cli init

# 4. Regenerate from source
cognition-cli genesis src/
cognition-cli genesis:docs docs/

# 5. Generate all overlays
cognition-cli overlay generate --all

# 6. Verify
cognition-cli status
cognition-cli coherence check
cognition-cli ask "test query"
```

---

### Selective Overlay Rebuild

**When to use**: Specific overlay corrupted, others OK

**Steps**:

```bash
# 1. Identify corrupted overlay
cognition-cli overlay list

# 2. Remove corrupted overlay
rm -rf .open_cognition/overlays/mission_concepts/

# 3. Regenerate specific overlay
cognition-cli overlay generate mission_concepts

# 4. Verify
cognition-cli overlay list
cognition-cli ask "mission-related query"
```

---

### LanceDB Repair

**When to use**: LanceDB queries failing, vectors corrupted

**Steps**:

```bash
# 1. Backup LanceDB (if partially working)
cp -r .open_cognition/lancedb/ /tmp/lancedb-backup/

# 2. Compact (repair) database
cognition-cli migrate-to-lance --compact

# 3. If compact fails, rebuild
rm -rf .open_cognition/lancedb/

# 4. Regenerate embeddings
cognition-cli genesis src/
cognition-cli genesis:docs docs/

# 5. Verify
cognition-cli ask "test query"
```

---

## Getting Help

### Self-Service Resources

1. **In-CLI Help**:

   ```bash
   cognition-cli guide
   cognition-cli <command> --help
   ```

2. **Documentation**:
   - [Quick Start Guide](../src/cognition-cli/docs/manual/part-0-quickstart/00-quick-start.md)
   - [CLI Operations Reference](../src/cognition-cli/docs/manual/part-1-foundation/05-cli-operations.md)
   - [The Lattice Book](README.md)

3. **Verbose Logging**:

   ```bash
   DEBUG=cognition:* cognition-cli <command>
   ```

4. **Check Logs**:

   ```bash
   # Workbench logs
   docker compose logs -f workbench

   # Operations log
   tail -f .open_cognition/workflow_log.jsonl
   ```

---

### Community Support

1. **GitHub Issues**:
   - Report bugs: <https://github.com/mirzahusadzic/cogx/issues>
   - Search existing issues for solutions

2. **Diagnostic Information** (include when reporting issues):

   ```bash
   # System info
   cognition-cli --version
   node --version
   docker --version

   # PGC status
   cognition-cli status

   # Overlay list
   cognition-cli overlay list

   # Workbench health
   curl http://localhost:8000/health

   # Recent logs
   tail -50 .open_cognition/workflow_log.jsonl
   ```

3. **Minimal Reproducible Example**:

   ```bash
   # Provide exact steps to reproduce
   # Example:
   # 1. cognition-cli init
   # 2. cognition-cli genesis src/
   # 3. cognition-cli ask "test"
   # Error: [exact error message]
   ```

---

## Prevention Best Practices

### 1. Enable Automatic Backups

```yaml
# .cogxrc.yml
pgc:
  backup:
    enabled: true
    interval: daily
    retention: 7
```

### 2. Use Pre-Commit Hooks

```bash
# .husky/pre-commit
#!/bin/sh
cognition-cli status || exit 1  # Fail commit if PGC incoherent
```

### 3. Monitor Coherence

```bash
# Check coherence after significant changes
git commit -m "Add feature X"
cognition-cli coherence check

# If delta negative, investigate before continuing
```

### 4. Regular Maintenance

```bash
# Weekly: Compact LanceDB
cognition-cli migrate-to-lance --compact

# Monthly: Regenerate all overlays
cognition-cli genesis src/
cognition-cli overlay generate --all
```

### 5. Version Control PGC (Optional)

```bash
# Add to .gitignore (exclude volatile data)
.open_cognition/lancedb/
.open_cognition/backups/

# Commit manifests and overlays (for team sharing)
git add .open_cognition/pgc.manifest.yaml
git add .open_cognition/overlays/
git commit -m "Update PGC overlays"
```

---

## Quick Reference: Error Code Table

| Error Code          | Meaning                    | Quick Fix                                  |
| ------------------- | -------------------------- | ------------------------------------------ |
| ECONNREFUSED        | Workbench not running      | `docker compose up -d`                     |
| ENOSPC              | Disk full                  | `docker system prune -a`                   |
| EACCES              | Permission denied          | Use `npx` or fix npm permissions           |
| ETIMEDOUT           | Network timeout            | Increase timeout in `.cogxrc.yml`          |
| YAML parse error    | Invalid YAML               | Fix syntax or restore backup               |
| PGC not initialized | Missing `.open_cognition/` | Run `cognition-cli wizard`                 |
| No results          | Empty overlays             | Run `cognition-cli overlay generate --all` |
| 429 Rate limit      | Too many requests          | Reduce concurrency or wait                 |
| 137 (Docker)        | Out of memory              | Increase Docker memory limit               |
| Circular dependency | Import cycle               | Fix with `madge --circular`                |

---

## Summary

**Troubleshooting Philosophy**:

- ✅ Start with simplest solutions (restart, regenerate)
- ✅ Use verbose logging (`DEBUG=cognition:*`)
- ✅ Check logs (workbench, operations log)
- ✅ Isolate the problem (test one component)
- ✅ Document what worked (for next time)

**Most Common Issues**:

1. Workbench not running → `docker compose up -d`
2. PGC not initialized → `cognition-cli wizard`
3. Empty overlays → `cognition-cli overlay generate --all`
4. Slow queries → Compact LanceDB, limit scope
5. Coherence drift → Check mission alignment

**When All Else Fails**:

- Nuclear reset (rebuild PGC from scratch)
- Report issue on GitHub with full diagnostic info
- Check documentation for recent updates

**Prevention > Recovery**:

- Enable automatic backups
- Monitor coherence regularly
- Use pre-commit hooks
- Maintain clean codebase

---

**Related Documentation**:

- [Quick Start Guide](../src/cognition-cli/docs/manual/part-0-quickstart/00-quick-start.md) — Basic troubleshooting
- [CLI Operations](../src/cognition-cli/docs/manual/part-1-foundation/05-cli-operations.md) — Command reference
- [Chapter 2: The PGC](../src/cognition-cli/docs/manual/part-1-foundation/02-the-pgc.md) — PGC structure
- [Chapter 18: Operational Flow](../src/cognition-cli/docs/manual/part-5-cpow-loop/18-operational-flow.md) — Transform pipeline

---

**End of Appendix A**
