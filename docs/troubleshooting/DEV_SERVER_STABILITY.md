# Dev Server Stability Guide

## Problem: Internal Server Error (ENOENT build manifest errors)

### Symptoms
- Frequent "Internal Server Error" responses on `localhost:3002`
- Console errors showing:
  ```
  Error: ENOENT: no such file or directory, open '/.next/static/development/_buildManifest.js.tmp.XXXXXX'
  ```
- Hot reload failures
- Intermittent 500 errors during development

### Root Causes

#### 1. **Multiple Next.js Instances**
Running multiple Next.js dev servers simultaneously causes:
- Resource contention (memory/CPU)
- Port conflicts
- File system race conditions
- Cache corruption

**How to check:**
```bash
ps aux | grep -i "next" | grep -v grep
lsof -i :3002
```

#### 2. **Turbopack Race Conditions**
Next.js 15.5.3 with Turbopack has known issues with:
- Temp file creation during hot reload
- Build manifest generation timing
- File system watching on macOS

**Known issues:**
- [Next.js #69592](https://github.com/vercel/next.js/issues/69592) - Turbopack errors
- Multiple PRs for test manifest fixes in v15.x

#### 3. **Cache Corruption**
`.next` directory cache can become corrupted due to:
- Interrupted builds
- Multiple server instances
- File system race conditions
- macOS file watching limitations

---

## Solutions

### Quick Fixes

#### 1. Clean Restart (Recommended First Step)
```bash
# Using Makefile
make dev-clean

# Or manually
rm -rf .next
rm -rf node_modules/.cache
pnpm dev
```

#### 2. Kill All Dev Servers
```bash
# Using Makefile
make dev-stop

# Or manually
lsof -ti:3002 | xargs kill -9 2>/dev/null
pkill -f "next dev.*3002"
```

#### 3. Use Stable Mode (Webpack instead of Turbopack)
```bash
# Using Makefile
make dev-stable

# Or using pnpm
pnpm dev:stable

# Or using Next.js directly
next dev -p 3002
```

---

### Long-term Solutions

#### 1. Monitored Dev Server (Auto-Restart)
Use the dev server monitor script for automatic crash recovery:

```bash
# Start with monitoring
make dev-monitor

# View logs
make dev-logs
```

**Features:**
- Auto-restart on crashes (max 5 attempts)
- Health checks every 10 seconds
- Automatic cache cleaning
- Comprehensive logging to `tmp/logs/dev-server.log`

#### 2. Configuration Improvements

**next.config.ts** now includes:
- Turbopack alias configuration for stable resolution
- Webpack file watching improvements (poll + aggregateTimeout)
- Optimized cache settings

**Key settings:**
```typescript
experimental: {
  turbo: {
    resolveAlias: {
      '@': './src',
    },
  },
},
webpack: (config) => {
  config.watchOptions = {
    poll: 1000,
    aggregateTimeout: 300,
    ignored: ['**/node_modules', '**/.next'],
  };
  return config;
}
```

#### 3. Resource Management

**Best Practices:**
- Keep only ONE dev server running per project
- Stop dev servers when switching projects
- Use `make dev-stop` before starting new sessions
- Close unused terminal windows with active servers

**Monitoring your dev servers:**
```bash
# Check running Next.js instances
ps aux | grep -i "next-server"

# Check memory usage
ps aux | grep -i "next" | awk '{sum+=$4} END {print "Total memory:", sum"%"}'
```

---

## Available Make Targets

### Development Commands
```bash
make dev              # Start normal dev server (with Turbopack)
make dev-clean        # Clean cache and restart
make dev-stable       # Start without Turbopack (webpack, more stable)
make dev-monitor      # Start with auto-restart monitoring
make dev-stop         # Stop all dev servers
make dev-logs         # View monitoring logs
make clean            # Clean all caches and logs
```

### Troubleshooting Workflow
1. **Try clean restart first:**
   ```bash
   make dev-clean
   ```

2. **If errors persist, use stable mode:**
   ```bash
   make dev-stable
   ```

3. **For production-like stability:**
   ```bash
   make dev-monitor
   ```

4. **To debug issues:**
   ```bash
   # Terminal 1
   make dev-monitor

   # Terminal 2
   make dev-logs
   ```

---

## Performance Optimization

### Reduce Resource Usage
1. **Close unused dev servers:**
   ```bash
   make dev-stop
   ```

2. **Clear all caches:**
   ```bash
   make clean
   ```

3. **Restart your terminal** (clears orphaned processes)

### macOS Specific Issues
macOS file watching has limitations. If you experience issues:

1. **Increase file watch limit:**
   ```bash
   # Check current limit
   sysctl kern.maxfiles

   # Increase (requires admin)
   sudo sysctl -w kern.maxfiles=65536
   ```

2. **Use webpack polling** (already configured in next.config.ts):
   - Polls every 1000ms instead of relying on FS events
   - More reliable on macOS but slightly slower

---

## Error Messages & Solutions

### "ENOENT: no such file or directory, open '/.next/static/development/_buildManifest.js.tmp.XXXXXX'"
**Solution:** Clean restart
```bash
make dev-clean
```

### "Port 3002 is already in use"
**Solution:** Kill existing servers
```bash
make dev-stop
make dev
```

### "Cannot find module '@/components/...'"
**Solution:** TypeScript path resolution issue
```bash
# Restart TypeScript server in VSCode
Cmd+Shift+P → "TypeScript: Restart TS Server"

# Or clean and rebuild
make clean
pnpm install
make dev
```

### Repeated crashes/restarts
**Solutions:**
1. Switch to stable mode: `make dev-stable`
2. Check for memory issues: `ps aux | grep next`
3. Reduce number of running dev servers
4. Restart terminal to clear zombie processes

---

## Monitoring & Debugging

### Check Server Health
```bash
# Server status
curl -I http://localhost:3002

# Detailed health check
curl http://localhost:3002/api/health || echo "Server not responding"
```

### Log Files
- **Dev server logs:** `tmp/logs/dev-server.log`
- **Error logs:** `tmp/logs/dev-server-errors.log`
- **PID file:** `tmp/dev-server.pid`

### View Logs in Real-Time
```bash
# Monitor logs
make dev-logs

# Or manually
tail -f tmp/logs/dev-server.log
```

---

## Prevention Checklist

Before starting development:
- [ ] Stop all other dev servers: `make dev-stop`
- [ ] Clean caches if last session had issues: `make clean`
- [ ] Check available memory: `free -m` or Activity Monitor
- [ ] Close unused terminal windows
- [ ] Use stable mode if experiencing frequent crashes

During development:
- [ ] Keep only ONE dev server running
- [ ] Monitor for error messages in console
- [ ] Use `make dev-clean` at first sign of issues
- [ ] Don't ignore cache-related warnings

---

## Environment Information

**Current Setup:**
- Next.js: 15.5.3
- Node.js: Check with `node -v`
- Package Manager: pnpm
- OS: macOS (Darwin 24.6.0)
- Dev Port: 3002

**Turbopack Status:**
- Development: ✅ Stable (with occasional race conditions)
- Production Build: ⚠️ Beta (not recommended for production)

---

## When to Use Each Mode

### Use `make dev` (Turbopack) when:
- ✅ Normal development (default)
- ✅ Fast refresh is critical
- ✅ You need bleeding-edge features

### Use `make dev-stable` (Webpack) when:
- ✅ Experiencing ENOENT errors
- ✅ Need guaranteed stability
- ✅ Working on critical features
- ✅ Deploying to production soon

### Use `make dev-monitor` when:
- ✅ Frequent crashes occur
- ✅ Long development sessions
- ✅ Working remotely (unreliable network)
- ✅ Need comprehensive logging

---

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Turbopack Documentation](https://nextjs.org/docs/app/api-reference/turbopack)
- [Next.js GitHub Issues](https://github.com/vercel/next.js/issues)
- [Project Troubleshooting Docs](./common-issues.md)

---

## Support

If issues persist after trying all solutions:
1. Check `tmp/logs/` for detailed error logs
2. Run diagnostics: `make quality`
3. Search [Next.js GitHub Issues](https://github.com/vercel/next.js/issues)
4. Document your issue with:
   - Error messages from logs
   - Steps to reproduce
   - Output of `next info`

---

**Last Updated:** 2025-10-18
**Next.js Version:** 15.5.3
**Status:** Active
