# Ollama Memory Configuration Guide

**Last Updated**: 2025-10-20

## Overview

This guide documents how to configure Ollama on macOS to use a maximum of 25GB RAM, preventing excessive memory consumption.

---

## Current Configuration

### Memory Limits
- **Maximum VRAM**: 25GB (25,769,803,776 bytes)
- **Max Loaded Models**: 1 (only one model in memory at a time)
- **Parallel Requests**: 1 (process one request at a time)

### Configuration Location
- **File**: `/Users/masa/Library/LaunchAgents/homebrew.mxcl.ollama.plist`
- **Backup**: `/Users/masa/Library/LaunchAgents/homebrew.mxcl.ollama.plist.backup`
- **Service Manager**: macOS launchd (Homebrew-managed)

---

## Environment Variables

The following environment variables control Ollama's memory usage:

| Variable | Value | Purpose |
|----------|-------|---------|
| `OLLAMA_MAX_VRAM` | `25769803776` | Maximum VRAM in bytes (25GB) |
| `OLLAMA_MAX_LOADED_MODELS` | `1` | Only keep 1 model in memory |
| `OLLAMA_NUM_PARALLEL` | `1` | Process 1 request at a time |
| `OLLAMA_FLASH_ATTENTION` | `1` | Memory-efficient attention (existing) |
| `OLLAMA_KV_CACHE_TYPE` | `q8_0` | Quantized KV cache (existing) |

---

## Configuration File Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>EnvironmentVariables</key>
	<dict>
		<key>OLLAMA_FLASH_ATTENTION</key>
		<string>1</string>
		<key>OLLAMA_KV_CACHE_TYPE</key>
		<string>q8_0</string>
		<key>OLLAMA_MAX_LOADED_MODELS</key>
		<string>1</string>
		<key>OLLAMA_NUM_PARALLEL</key>
		<string>1</string>
		<key>OLLAMA_MAX_VRAM</key>
		<string>25769803776</string>
	</dict>
	<!-- ... rest of plist ... -->
</dict>
</plist>
```

---

## Service Management Commands

### Restart Ollama Service
```bash
# Unload service
launchctl unload ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist

# Reload service with new configuration
launchctl load ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
```

### Check Service Status
```bash
# Check if service is running
launchctl list | grep ollama

# View running process
ps aux | grep ollama | grep -v grep

# Check Ollama connectivity
ollama list
```

### View Logs
```bash
# View Ollama logs
tail -f /opt/homebrew/var/log/ollama.log

# Check for errors
grep -i error /opt/homebrew/var/log/ollama.log
```

---

## Memory Management Commands

### Check Current Memory Usage
```bash
# View Ollama memory usage
ps aux | grep ollama | grep -v grep | awk '{print $3"% CPU, "$4"% MEM, "$6" KB"}'

# More detailed memory info (macOS)
top -l 1 | grep ollama
```

### Unload Models to Free Memory
```bash
# Stop a specific model to free memory
ollama stop deepseek-v3.1

# List currently loaded models
ollama ps
```

### Test Memory Limits
```bash
# Load a large model and monitor memory
ollama run deepseek-v3.1 "Hello"

# In another terminal, watch memory usage
watch -n 2 'ps aux | grep ollama | grep -v grep'
```

---

## Adjusting Memory Limits

### Change Maximum Memory
1. Edit the configuration file:
   ```bash
   nano ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
   ```

2. Modify the `OLLAMA_MAX_VRAM` value:
   - **15GB**: `16106127360`
   - **20GB**: `21474836480`
   - **25GB**: `25769803776` (current)
   - **30GB**: `32212254720`
   - **40GB**: `42949672960`

3. Restart the service:
   ```bash
   launchctl unload ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
   launchctl load ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
   ```

### Allow Multiple Models in Memory
1. Edit `OLLAMA_MAX_LOADED_MODELS`:
   ```xml
   <key>OLLAMA_MAX_LOADED_MODELS</key>
   <string>2</string>  <!-- or 3, 4, etc. -->
   ```

2. Restart service (as above)

**Note**: With 25GB limit, you can typically only fit one large model (70B+) in memory.

---

## Verification Steps

### 1. Check Configuration is Applied
```bash
# View environment variables of running Ollama process
ps eww $(pgrep ollama) | tr ' ' '\n' | grep OLLAMA
```

### 2. Load a Large Model
```bash
# Test with a large model (deepseek-v3.1 is 404GB on disk, but uses less in RAM)
ollama run deepseek-v3.1 "Write a haiku about memory management"
```

### 3. Monitor Memory Usage
```bash
# Check memory usage during model load
# Should stay under ~25GB for the ollama process
watch -n 1 'ps aux | grep ollama | grep -v grep'
```

### 4. Check Logs for Issues
```bash
# Look for memory-related warnings
tail -f /opt/homebrew/var/log/ollama.log | grep -i memory
```

---

## Troubleshooting

### Model Fails to Load
**Symptom**: Model doesn't load or crashes
**Solution**:
- Model may be too large for 25GB limit
- Try a smaller quantization or model size
- Increase memory limit if system has more RAM available

### Service Won't Restart
**Symptom**: `launchctl load` fails
**Solution**:
```bash
# Check plist syntax
plutil -lint ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist

# Restore backup if needed
cp ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist.backup ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
```

### Memory Still Exceeds Limit
**Symptom**: Ollama uses more than 25GB
**Solution**:
- `OLLAMA_MAX_VRAM` is a soft limit for GPU/Metal memory
- System RAM usage may be additional
- Consider setting `OLLAMA_MAX_LOADED_MODELS=1` (already set)
- Manually unload models: `ollama stop <model>`

---

## Best Practices

### Model Selection
Given 25GB memory limit:
- **7B models**: ~5-8GB RAM (qwen2.5-coder:7b, mistral:latest)
- **14B-20B models**: ~12-20GB RAM (mistral-small3.2:latest)
- **70B models**: ~35-45GB RAM (**exceeds limit**, may need swap)
- **Large models** (405B, deepseek-v3.1): **Requires disk swap**, very slow

### Recommended Workflow
1. Use smaller models (7B-14B) for most tasks
2. Keep only one model loaded at a time
3. Explicitly stop models when done: `ollama stop <model>`
4. Monitor memory usage regularly
5. For large models, consider:
   - Using API services (OpenRouter, Anthropic, OpenAI)
   - Cloud GPU instances
   - Increasing memory limit temporarily

---

## Automated Verification Script

Location: `/Users/masa/Projects/recipe-manager/scripts/verify-ollama-memory.sh`

Run with:
```bash
bash scripts/verify-ollama-memory.sh
```

---

## Quick Reference

### Common Commands
```bash
# Restart Ollama
launchctl unload ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist && \
launchctl load ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist

# Check memory usage
ps aux | grep ollama | grep -v grep

# List running models
ollama ps

# Stop a model
ollama stop <model-name>

# View configuration
cat ~/Library/LaunchAgents/homebrew.mxcl.ollama.plist
```

### Memory Conversion Table
| GB | Bytes |
|----|-------|
| 10 | 10737418240 |
| 15 | 16106127360 |
| 20 | 21474836480 |
| 25 | 25769803776 |
| 30 | 32212254720 |
| 40 | 42949672960 |
| 50 | 53687091200 |

---

## Related Documentation

- **Ollama GitHub**: https://github.com/ollama/ollama
- **Ollama Documentation**: https://github.com/ollama/ollama/blob/main/docs/faq.md
- **Environment Variables**: https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-configure-ollama

---

**Configuration Applied**: 2025-10-20
**Backup Created**: `/Users/masa/Library/LaunchAgents/homebrew.mxcl.ollama.plist.backup`
**Service Status**: Active and running with 25GB memory limit
