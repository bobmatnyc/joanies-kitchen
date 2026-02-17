# API Keys Migration Script

## Overview

The `apply-api-keys-migration.ts` script creates the API keys infrastructure tables in the production database.

## Tables Created

### 1. `api_keys` (19 columns)
- **Primary Key**: UUID with auto-generation
- **User Association**: `user_id` (text) for Clerk integration
- **Key Storage**: SHA-256 hash + prefix for security
- **Permissions**: JSON scopes array for fine-grained access control
- **Lifecycle**: Active/inactive flag, expiration dates, revocation tracking
- **Audit Trail**: Created by, revoked by, revocation reason
- **Indexes**: 9 performance indexes (user_id, key_hash, is_active, expires_at, etc.)

### 2. `api_key_usage` (14 columns)
- **Primary Key**: UUID with auto-generation
- **Foreign Key**: `api_key_id` → `api_keys.id` (CASCADE DELETE)
- **Request Details**: Endpoint, method, status code
- **Performance**: Response time, request/response sizes
- **Network**: IP address, user agent
- **Error Tracking**: Error messages and codes
- **Metadata**: JSONB for custom data
- **Indexes**: 9 performance indexes for analytics queries

## Usage

### Dry Run (Default - Safe Mode)
```bash
pnpm tsx scripts/apply-api-keys-migration.ts
```

This will:
- Check if tables already exist
- Show what would be created
- NOT make any changes to the database

### Apply Changes
```bash
APPLY_CHANGES=true pnpm tsx scripts/apply-api-keys-migration.ts
```

This will:
- Create both tables if they don't exist
- Add all indexes and constraints
- Verify the migration was successful
- Show column counts and index counts

## Safety Features

### Idempotent
The script can be run multiple times safely:
- Checks if tables exist before creating
- Uses `IF NOT EXISTS` for all operations
- Exits gracefully if tables already exist

### Verification
After applying changes, the script:
- Verifies both tables were created
- Shows column counts
- Shows index counts
- Provides next steps

### Error Handling
- Catches and displays errors clearly
- Exits with appropriate status codes
- Uses transactions where possible

## Example Output

### Dry Run
```
========================================
API KEYS MIGRATION
========================================

🔍 DRY RUN MODE - No changes will be made
   Set APPLY_CHANGES=true to execute

Checking existing tables...
  ✓ api_keys table does not exist
  ✓ api_key_usage table does not exist

Will create:
  - api_keys table (18 columns)
    • Primary key, user association
    • Secure key storage (hash + prefix)
    • Permission scopes and lifecycle management
    • Audit trail and usage statistics
    • 9 performance indexes
  - api_key_usage table (14 columns)
    • Request tracking and analytics
    • Performance metrics
    • Error logging
    • 8 performance indexes
    • Foreign key cascade to api_keys

========================================
Run with APPLY_CHANGES=true to execute
========================================
```

### Apply Mode (Success)
```
========================================
API KEYS MIGRATION
========================================

⚠️  APPLY MODE - Changes will be made to database

Checking existing tables...
  ✓ api_keys table does not exist
  ✓ api_key_usage table does not exist

📝 Applying migration...

Creating api_keys table...
  ✅ api_keys table created
  Creating indexes...
    ✓ api_keys_user_id_idx
    ✓ api_keys_key_hash_idx
    [... all indexes ...]

Creating api_key_usage table...
  ✅ api_key_usage table created
  Creating indexes...
    [... all indexes ...]

🔍 Verifying migration...
  ✅ Both tables created successfully

========================================
✅ Migration completed successfully!
========================================

Next steps:
  1. Test API key creation: /api/keys/create
  2. Test authentication: /api/auth/validate
  3. Monitor usage: /api/keys/usage
```

### Apply Mode (Already Exists)
```
========================================
API KEYS MIGRATION
========================================

⚠️  APPLY MODE - Changes will be made to database

Checking existing tables...
  ℹ️  api_keys table already exists
     Current rows: 0
  ℹ️  api_key_usage table already exists
     Current rows: 0

✅ All tables already exist. Migration not needed.
```

## Schema Details

### api_keys Table
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  key_hash VARCHAR(64) UNIQUE NOT NULL,
  key_prefix VARCHAR(12) NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  environment VARCHAR(20) DEFAULT 'production',
  total_requests INTEGER NOT NULL DEFAULT 0,
  last_ip_address VARCHAR(45),
  created_by TEXT,
  revoked_at TIMESTAMP,
  revoked_by TEXT,
  revocation_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### api_key_usage Table
```sql
CREATE TABLE api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  error_message TEXT,
  error_code VARCHAR(50),
  metadata JSONB,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Related Files

- **Schema Definition**: `src/lib/db/api-keys-schema.ts`
- **Database Connection**: `src/lib/db/index.ts`
- **Migration Script**: `scripts/apply-api-keys-migration.ts`

## Next Steps After Migration

1. **Create API Key Service**: Implement key generation and validation
2. **Add Authentication Middleware**: Protect routes with API key auth
3. **Build Management UI**: Admin interface for key management
4. **Set Up Monitoring**: Track usage and performance metrics
5. **Implement Rate Limiting**: Protect against abuse
