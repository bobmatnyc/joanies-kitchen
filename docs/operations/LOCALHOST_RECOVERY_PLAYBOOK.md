# Localhost Development Server Recovery Playbook

**Last Updated**: 2025-10-27
**Version**: 1.0.0
**Server**: Next.js 15.5.3 with Turbopack on port 3002
**Process Manager**: PM2 with auto-restart enabled

---

## Quick Reference

```bash
# Check if server is running
pm2 status recipe-dev
curl -I http://localhost:3002

# View logs
pm2 logs recipe-dev

# Restart server
pm2 restart recipe-dev

# Stop server
pm2 stop recipe-dev

# Start server
pnpm dev:pm2
```

---

## Server Configuration

### PM2 Configuration
- **Process Name**: `recipe-dev`
- **Port**: 3002
- **Auto-restart**: Enabled
- **Max Memory**: 2GB
- **Max Restarts**: 10 per hour
- **Min Uptime**: 10 seconds
- **Restart Delay**: 4 seconds
- **Log Location**: `./tmp/logs/pm2-dev-*.log`

### Current Setup
- **Next.js Version**: 15.5.3
- **Build Tool**: Turbopack (development mode)
- **Environment**: Development
- **Environment File**: `.env.local`

---

## Health Check Procedures

### 1. Quick Health Check
```bash
# Check PM2 status
pm2 status recipe-dev

# Expected output:
# ┌────┬────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┐
# │ id │ name       │ mode    │ pid      │ uptime │ ↺    │ status    │
# ├────┼────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┤
# │ 4  │ recipe-dev │ fork    │ 69815    │ 5m     │ 1    │ online    │
# └────┴────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┘
```

### 2. HTTP Response Check
```bash
curl -I http://localhost:3002

# Expected output:
# HTTP/1.1 200 OK
# x-clerk-auth-reason: dev-browser-missing
# x-clerk-auth-status: signed-out
```

### 3. Port Availability Check
```bash
lsof -ti:3002

# Should return a process ID
# If empty, port is not in use
```

### 4. Log Health Check
```bash
pm2 logs recipe-dev --lines 50 --nostream

# Look for:
# ✓ Ready in [time]ms
# ✓ Compiled middleware
# - Local: http://localhost:3002
```

---

## Common Issues and Solutions

### Issue 1: Port Already in Use

**Symptoms**:
- PM2 shows "online" but server not accessible
- Error logs show: `EADDRINUSE: address already in use :::3002`

**Solution**:
```bash
# Find process using port 3002
lsof -ti:3002

# Kill the process (replace PID with actual process ID)
kill -9 <PID>

# Restart PM2
pm2 restart recipe-dev

# Wait 10 seconds for startup
sleep 10

# Verify
curl -I http://localhost:3002
```

### Issue 2: PM2 Not Running

**Symptoms**:
- `pm2 status` shows empty or missing `recipe-dev`

**Solution**:
```bash
# Start with PM2
pnpm dev:pm2

# Wait for startup
sleep 15

# Verify
pm2 status recipe-dev
curl -I http://localhost:3002
```

### Issue 3: Server Crashing Repeatedly

**Symptoms**:
- PM2 shows high restart count (↺ > 5)
- Status flickers between "online" and "errored"

**Solution**:
```bash
# Check error logs
pm2 logs recipe-dev --err --lines 100

# Common fixes:

# 1. Clear Next.js cache
rm -rf .next
pm2 restart recipe-dev

# 2. Clear node_modules cache
rm -rf node_modules/.cache
pm2 restart recipe-dev

# 3. Check for code errors
pnpm tsc --noEmit

# 4. If database issues, check connection
psql $DATABASE_URL -c "SELECT 1"

# 5. Last resort: full clean restart
pm2 stop recipe-dev
pm2 delete recipe-dev
rm -rf .next
pnpm dev:pm2
```

### Issue 4: Memory Issues

**Symptoms**:
- PM2 memory shows > 1.5GB
- Server becomes unresponsive
- PM2 auto-restarts due to memory limit

**Solution**:
```bash
# Check memory usage
pm2 status

# Manual restart
pm2 restart recipe-dev

# If persistent, increase memory limit in ecosystem.config.js:
# max_memory_restart: '3G' (increase from 2G)

# Or investigate memory leaks:
pm2 logs recipe-dev --lines 200 | grep "memory"
```

### Issue 5: Build Errors After Code Changes

**Symptoms**:
- Server won't start after pulling new code
- TypeScript errors in logs
- Module not found errors

**Solution**:
```bash
# Stop server
pm2 stop recipe-dev

# Clean build artifacts
rm -rf .next
rm -rf node_modules/.cache

# Reinstall dependencies (if package.json changed)
pnpm install

# Restart
pnpm dev:pm2

# If TypeScript errors persist:
pnpm tsc --noEmit
# Fix errors, then restart
```

---

## Recovery Procedures

### Complete Server Restart (Safe)

```bash
# 1. Stop server gracefully
pm2 stop recipe-dev

# 2. Clean build cache
rm -rf .next

# 3. Restart
pnpm dev:pm2

# 4. Wait for startup (15 seconds)
sleep 15

# 5. Verify
pm2 status recipe-dev
curl -I http://localhost:3002
```

### Emergency Force Restart

```bash
# 1. Kill all processes on port 3002
lsof -ti:3002 | xargs kill -9

# 2. Delete PM2 process
pm2 delete recipe-dev

# 3. Clean caches
rm -rf .next node_modules/.cache

# 4. Fresh start
pnpm dev:pm2

# 5. Monitor startup
pm2 logs recipe-dev
```

### Database Connection Recovery

```bash
# 1. Test database connection
psql $DATABASE_URL -c "SELECT 1"

# 2. If connection fails, check .env.local
cat .env.local | grep DATABASE_URL

# 3. Test from Node.js
node -e "const { neon } = require('@neondatabase/serverless'); const sql = neon(process.env.DATABASE_URL); sql\`SELECT 1\`.then(console.log);"

# 4. Restart server after fixing connection
pm2 restart recipe-dev
```

---

## Monitoring Commands

### Real-time Monitoring

```bash
# PM2 dashboard (interactive)
pm2 monit

# Live logs (streaming)
pm2 logs recipe-dev

# System resource usage
pm2 status
```

### Log Analysis

```bash
# Last 100 lines
pm2 logs recipe-dev --lines 100 --nostream

# Only errors
pm2 logs recipe-dev --err --lines 50

# Search logs for specific pattern
pm2 logs recipe-dev --lines 500 --nostream | grep "ERROR"

# Export logs for analysis
pm2 logs recipe-dev --lines 1000 --nostream > debug.log
```

### Performance Metrics

```bash
# CPU and memory usage
pm2 status

# Detailed process info
pm2 describe recipe-dev

# Process uptime and restart count
pm2 list | grep recipe-dev
```

---

## Crash Detection

### Automatic Detection

PM2 automatically detects and handles crashes:
- **Auto-restart**: Enabled (up to 10 times per hour)
- **Min uptime**: Process must stay alive for 10 seconds
- **Restart delay**: 4-second delay between restarts

### Manual Crash Detection

```bash
# Check for crash indicators
pm2 describe recipe-dev | grep -E "restart_time|uptime|restarts"

# If restart count is high:
pm2 describe recipe-dev

# Expected output if healthy:
# restarts: 0-2
# uptime: > 5 minutes

# If unhealthy:
# restarts: > 5
# uptime: < 1 minute
```

---

## Alert Configuration (Future Enhancement)

### Recommended Monitoring Tools

1. **PM2 Plus** (optional paid service)
   - Real-time monitoring
   - Email/SMS alerts
   - Custom metrics

2. **Simple Bash Script Alert** (free)
   ```bash
   # Add to crontab (runs every 5 minutes)
   */5 * * * * /path/to/check-server.sh
   ```

3. **Slack/Discord Webhook** (custom)
   - Send alert on high restart count
   - Send alert on memory threshold
   - Send alert on error rate

---

## Testing Recovery Procedures

### Test 1: Graceful Restart
```bash
pm2 restart recipe-dev
sleep 15
curl -I http://localhost:3002
# Expected: HTTP 200
```

### Test 2: Force Kill and Auto-Restart
```bash
# Get PID
PID=$(pm2 jlist | jq -r '.[] | select(.name=="recipe-dev") | .pid')

# Kill process
kill -9 $PID

# Wait for PM2 auto-restart
sleep 10

# Verify
pm2 status recipe-dev
# Expected: status = online, restarts = +1
```

### Test 3: Port Conflict Recovery
```bash
# Create port conflict
node -e "require('http').createServer().listen(3002)" &
CONFLICT_PID=$!

# Try to start server (should fail)
pm2 restart recipe-dev

# Resolve conflict
kill -9 $CONFLICT_PID

# Restart (should succeed)
pm2 restart recipe-dev
sleep 15
curl -I http://localhost:3002
```

### Test 4: Memory Limit Recovery
```bash
# Simulate memory stress (not recommended in production)
# PM2 will auto-restart at 2GB limit

# Monitor
pm2 status recipe-dev

# If auto-restart triggered:
# restarts counter will increase
# Process should recover automatically
```

---

## Useful Aliases (Add to .bashrc or .zshrc)

```bash
# Quick status check
alias dev-status='pm2 status recipe-dev && curl -I http://localhost:3002'

# Quick logs
alias dev-logs='pm2 logs recipe-dev --lines 50'

# Quick restart
alias dev-restart='pm2 restart recipe-dev && sleep 15 && curl -I http://localhost:3002'

# Quick stop
alias dev-stop='pm2 stop recipe-dev'

# Quick start
alias dev-start='cd /Users/masa/Projects/joanies-kitchen && pnpm dev:pm2'

# Emergency clean restart
alias dev-clean='pm2 stop recipe-dev && rm -rf .next && pnpm dev:pm2'
```

---

## Troubleshooting Decision Tree

```
Is server accessible at http://localhost:3002?
├─ YES → Server is healthy ✓
└─ NO
   ├─ Is PM2 running? (pm2 status recipe-dev)
   │  ├─ NO → Run: pnpm dev:pm2
   │  └─ YES
   │     ├─ Is port 3002 in use? (lsof -ti:3002)
   │     │  ├─ NO → Server crashed, check logs: pm2 logs recipe-dev --err
   │     │  └─ YES
   │     │     ├─ Is PID matching PM2? (compare PID)
   │     │     │  ├─ YES → Check logs for startup errors
   │     │     │  └─ NO → Kill conflict, restart: kill -9 <PID> && pm2 restart
   │     └─ Check error logs: pm2 logs recipe-dev --err --lines 100
```

---

## Emergency Contacts / Resources

- **Documentation**: [Next.js Docs](https://nextjs.org/docs)
- **PM2 Documentation**: [PM2 Docs](https://pm2.keymetrics.io/docs)
- **Project GitHub**: (add your repo link)
- **Issue Tracker**: (add your issue tracker link)

---

## Checklist Before Escalation

Before reaching out for help, ensure you've tried:

- [ ] `pm2 restart recipe-dev`
- [ ] Checked logs with `pm2 logs recipe-dev --err --lines 100`
- [ ] Verified port 3002 is not blocked
- [ ] Checked database connection
- [ ] Cleared `.next` cache
- [ ] Verified `.env.local` exists and has correct values
- [ ] Confirmed dependencies are installed (`pnpm install`)
- [ ] Checked for code errors (`pnpm tsc --noEmit`)

---

## Version History

| Version | Date       | Changes                                |
|---------|------------|----------------------------------------|
| 1.0.0   | 2025-10-27 | Initial playbook after API v1 merge    |

---

**Generated after successful API v1 merge and PM2 configuration**
