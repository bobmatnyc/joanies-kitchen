# Ollama Memory Configuration - Quick Start

**Status**: ✓ Configured and Active
**Date**: 2025-10-20
**Memory Limit**: 25GB

---

## What Was Done

Ollama has been configured to use a maximum of 25GB RAM to prevent excessive memory consumption on your system.

### Configuration Applied:
- **Max VRAM**: 25GB (25,769,803,776 bytes)
- **Max Loaded Models**: 1 (only one model in memory at a time)
- **Parallel Requests**: 1 (process one request at a time)
- **Service**: Running via macOS launchd (Homebrew-managed)

---

## Quick Commands

### Check if configuration is working:
```bash
bash scripts/verify-ollama-memory.sh
```

### Check current memory usage:
```bash
ps aux | grep ollama | grep -v grep
```

### List currently loaded models:
```bash
ollama ps
```

### Stop a model to free memory:
```bash
ollama stop <model-name>
```

### Restart Ollama service:
```bash
launchctl unload ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
launchctl load ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
```

---

## Helper Functions

Source the helper script to get convenient functions:

```bash
source scripts/ollama-memory-commands.sh

# Then use functions like:
check_memory        # Show current memory usage
watch_memory        # Monitor memory in real-time
stop_all            # Stop all loaded models
verify              # Run full verification
```

---

## Important Notes

### Model Sizes vs Memory
With a 25GB limit, you can typically run:

| Model Size | Approximate RAM | Examples |
|------------|----------------|----------|
| 7B models | ~5-8GB | qwen2.5-coder:7b, mistral:latest |
| 14-20B models | ~12-20GB | mistral-small3.2:latest |
| 70B models | ~35-45GB | **Exceeds limit** - will use swap |
| 405B+ models | 100GB+ | **Exceeds limit** - very slow |

### Recommended Workflow
1. Use smaller models (7B-14B) for most tasks
2. Only one model loads at a time (automatically enforced)
3. Manually stop models when done: `ollama stop <model>`
4. Monitor memory if running large models

### What to Do If Memory Exceeds Limit
```bash
# 1. Check what's loaded
ollama ps

# 2. Stop all models
source scripts/ollama-memory-commands.sh
stop_all

# 3. Verify memory dropped
check_memory
```

---

## Files Created

### Documentation:
- `docs/guides/OLLAMA_MEMORY_CONFIGURATION.md` - Full configuration guide
- `docs/guides/OLLAMA_MEMORY_QUICK_START.md` - This quick start guide

### Scripts:
- `scripts/verify-ollama-memory.sh` - Verification script
- `scripts/ollama-memory-commands.sh` - Helper functions

### Configuration:
- `~/Library/LaunchAgents/homebrew.mxcl.ollama.plist` - Ollama service config
- `~/Library/LaunchAgents/homebrew.mxcl.ollama.plist.backup` - Original backup

---

## Adjusting the Memory Limit

To change the 25GB limit, edit the configuration file:

```bash
# 1. Edit the plist
nano ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist

# 2. Find OLLAMA_MAX_VRAM and change the value:
# 15GB: 16106127360
# 20GB: 21474836480
# 25GB: 25769803776 (current)
# 30GB: 32212254720
# 40GB: 42949672960

# 3. Restart Ollama
launchctl unload ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
launchctl load ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist

# 4. Verify
bash scripts/verify-ollama-memory.sh
```

---

## Troubleshooting

### Ollama won't start after configuration change
```bash
# Check plist syntax
plutil -lint ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist

# Restore backup if needed
cp ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist.backup \
   ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
```

### Model fails to load
The model might be too large for the 25GB limit. Try:
1. Using a smaller quantization (e.g., 7B instead of 70B)
2. Increasing the memory limit (if your system has more RAM)
3. Using API services for large models (OpenRouter, Anthropic)

### Memory still exceeds limit
```bash
# Stop all models
ollama ps | tail -n +2 | awk '{print $1}' | xargs -n1 ollama stop

# Restart Ollama
launchctl unload ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
launchctl load ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
```

---

## Next Steps

1. **Test the configuration**:
   ```bash
   bash scripts/verify-ollama-memory.sh
   ```

2. **Try loading a small model**:
   ```bash
   ollama run mistral:latest "Hello, how are you?"
   ```

3. **Monitor memory usage**:
   ```bash
   source scripts/ollama-memory-commands.sh
   watch_memory
   ```

4. **Read full documentation** for advanced options:
   ```bash
   cat docs/guides/OLLAMA_MEMORY_CONFIGURATION.md
   ```

---

## Support

For more information:
- **Full Guide**: `docs/guides/OLLAMA_MEMORY_CONFIGURATION.md`
- **Helper Functions**: `bash scripts/ollama-memory-commands.sh`
- **Verification**: `bash scripts/verify-ollama-memory.sh`
- **Ollama Docs**: https://github.com/ollama/ollama/blob/main/docs/faq.md

---

**Configuration Status**: ✓ Active and running
**Last Verified**: 2025-10-20
**Service Status**: Running (PID varies)
