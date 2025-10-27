# API Authentication Guide

Complete guide to authenticating with the Joanie's Kitchen API.

---

## Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
- [API Keys](#api-keys)
  - [Creating API Keys](#creating-api-keys)
  - [Using API Keys](#using-api-keys)
  - [Managing API Keys](#managing-api-keys)
- [Scopes & Permissions](#scopes--permissions)
- [Code Examples](#code-examples)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Joanie's Kitchen API supports two authentication methods:

1. **API Keys** - For programmatic access (recommended for apps, scripts, integrations)
2. **Clerk Sessions** - For web applications (automatic session handling)

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Incoming API Request                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ Check Authorization   │
                  │ header                │
                  └───────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌──────────────┐
│ Bearer Token  │   │ Basic Auth      │   │ Clerk        │
│ (API Key)     │   │ (Not Yet Impl)  │   │ Session      │
└───────────────┘   └─────────────────┘   └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                  ┌───────────────────────┐
                  │ Validate & Extract    │
                  │ userId + scopes       │
                  └───────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ Execute API Request   │
                  └───────────────────────┘
```

---

## Authentication Methods

### 1. API Keys (Bearer Token)

**Use For**: Server-to-server, mobile apps, scripts, CI/CD pipelines

**Format**:
```
Authorization: Bearer jk_live_abc123def456...
```

**Key Prefix**:
- Production: `jk_live_`
- Development: `jk_test_`

**Advantages**:
- Fine-grained permissions via scopes
- Easy to rotate and revoke
- Track usage per key
- No session management needed

### 2. Clerk Sessions (Cookies)

**Use For**: Web applications with user login

**Format**: Automatic (cookies)

**Advantages**:
- Seamless integration with Clerk authentication
- Automatic session management
- Full user permissions by default

---

## API Keys

### Creating API Keys

API keys can **only** be created via Clerk session authentication (web interface). This prevents API keys from creating other API keys (security measure).

#### Via Web Interface

1. Login to https://your-domain.com
2. Navigate to **Settings** → **API Keys**
3. Click **Create API Key**
4. Configure:
   - **Name**: Descriptive name (e.g., "Mobile App", "CI/CD Pipeline")
   - **Scopes**: Select required permissions
   - **Description** (optional): Additional notes
   - **Expires At** (optional): Expiration date

5. **Copy the key immediately** - it will only be shown once!

#### Via API (Clerk Session Required)

**Endpoint**: `POST /api/v1/auth/keys`

**Authentication**: Must use Clerk session (cookies), NOT API key

**Request**:
```bash
curl -X POST "https://your-domain.com/api/v1/auth/keys" \
  -H "Content-Type: application/json" \
  -b "cookies.txt" \
  -d '{
    "name": "Mobile App",
    "scopes": ["read:recipes", "write:recipes", "read:meals", "write:meals"],
    "description": "API key for iOS mobile app",
    "expiresAt": "2026-12-31T23:59:59Z"
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "apiKey": "jk_live_abc123def456...",
    "keyPrefix": "jk_live_abc1",
    "name": "Mobile App",
    "scopes": ["read:recipes", "write:recipes", "read:meals", "write:meals"],
    "description": "API key for iOS mobile app",
    "expiresAt": "2026-12-31T23:59:59Z",
    "createdAt": "2025-10-27T12:00:00Z",
    "warning": "This key will only be shown once. Store it securely."
  }
}
```

**IMPORTANT**: The `apiKey` field contains the full key and will **never be shown again**. Store it securely!

### Using API Keys

#### Basic Usage

```bash
curl -X GET "https://your-domain.com/api/v1/recipes" \
  -H "Authorization: Bearer jk_live_abc123def456..." \
  -H "Content-Type: application/json"
```

#### Environment Variables (Recommended)

**Bash/Unix**:
```bash
export JOANIE_API_KEY="jk_live_abc123def456..."

curl -X GET "https://your-domain.com/api/v1/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json"
```

**JavaScript/Node.js**:
```javascript
// .env file
JOANIE_API_KEY=jk_live_abc123def456...

// Code
const apiKey = process.env.JOANIE_API_KEY;

const response = await fetch('https://your-domain.com/api/v1/recipes', {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
});
```

**Python**:
```python
# .env file
JOANIE_API_KEY=jk_live_abc123def456...

# Code
import os

api_key = os.environ['JOANIE_API_KEY']

response = requests.get(
    'https://your-domain.com/api/v1/recipes',
    headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
)
```

### Managing API Keys

#### List All Keys

**Endpoint**: `GET /api/v1/auth/keys`

**Authentication**: Clerk session only

```bash
curl -X GET "https://your-domain.com/api/v1/auth/keys" \
  -b "cookies.txt"
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "keyPrefix": "jk_live_abc1",
      "name": "Mobile App",
      "scopes": ["read:recipes", "write:recipes"],
      "isActive": true,
      "lastUsedAt": "2025-10-27T11:30:00Z",
      "totalRequests": 1523,
      "expiresAt": null,
      "environment": "production",
      "createdAt": "2025-10-20T10:00:00Z",
      "updatedAt": "2025-10-27T11:30:00Z"
    }
  ]
}
```

#### Get Key Details

**Endpoint**: `GET /api/v1/auth/keys/:id`

**Authentication**: Clerk session or API key (can view own details)

```bash
curl -X GET "https://your-domain.com/api/v1/auth/keys/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

#### Update Key

**Endpoint**: `PATCH /api/v1/auth/keys/:id`

**Authentication**: Clerk session only

```bash
curl -X PATCH "https://your-domain.com/api/v1/auth/keys/550e8400-e29b-41d4-a716-446655440000" \
  -b "cookies.txt" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App (Updated)",
    "scopes": ["read:recipes", "write:recipes", "read:meals"]
  }'
```

#### Revoke Key

**Endpoint**: `DELETE /api/v1/auth/keys/:id`

**Authentication**: Clerk session only

```bash
curl -X DELETE "https://your-domain.com/api/v1/auth/keys/550e8400-e29b-41d4-a716-446655440000" \
  -b "cookies.txt"
```

#### Get Usage Statistics

**Endpoint**: `GET /api/v1/auth/keys/:id/usage`

**Authentication**: Clerk session or API key (can view own usage)

**Query Parameters**:
- `startDate`: Start date (ISO 8601)
- `endDate`: End date (ISO 8601)
- `groupBy`: Group by day/hour (optional)

```bash
curl -X GET "https://your-domain.com/api/v1/auth/keys/550e8400-e29b-41d4-a716-446655440000/usage?startDate=2025-10-01&endDate=2025-10-27" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "keyId": "550e8400-e29b-41d4-a716-446655440000",
    "totalRequests": 1523,
    "successfulRequests": 1498,
    "failedRequests": 25,
    "lastUsedAt": "2025-10-27T11:30:00Z",
    "topEndpoints": [
      { "endpoint": "/api/v1/recipes", "count": 856 },
      { "endpoint": "/api/v1/meals", "count": 423 }
    ]
  }
}
```

---

## Scopes & Permissions

Scopes define what an API key can access. Use the principle of least privilege - only grant necessary permissions.

### Scope Format

Scopes follow the pattern: `action:resource` or `resource:*`

Examples:
- `read:recipes` - Read recipes only
- `write:recipes` - Create/update recipes
- `recipes:*` - All recipe operations
- `*` - All operations (use with caution!)

### Available Scopes

#### Recipe Scopes
| Scope | Description |
|-------|-------------|
| `read:recipes` | View recipes |
| `write:recipes` | Create and update recipes |
| `delete:recipes` | Delete recipes |
| `recipes:*` | All recipe operations |

#### Meal Scopes
| Scope | Description |
|-------|-------------|
| `read:meals` | View meals |
| `write:meals` | Create and update meals |
| `delete:meals` | Delete meals |
| `meals:*` | All meal operations |

#### Ingredient Scopes
| Scope | Description |
|-------|-------------|
| `read:ingredients` | View ingredients |
| `write:ingredients` | Create and update ingredients |
| `delete:ingredients` | Delete ingredients |
| `ingredients:*` | All ingredient operations |

#### Collection Scopes
| Scope | Description |
|-------|-------------|
| `read:collections` | View recipe collections |
| `write:collections` | Create and update collections |
| `delete:collections` | Delete collections |
| `collections:*` | All collection operations |

#### Inventory Scopes
| Scope | Description |
|-------|-------------|
| `read:inventory` | View inventory items |
| `write:inventory` | Create and update inventory |
| `delete:inventory` | Delete inventory items |
| `inventory:*` | All inventory operations |

#### Chef Scopes
| Scope | Description |
|-------|-------------|
| `read:chefs` | View chef profiles |
| `write:chefs` | Create and update chefs |
| `delete:chefs` | Delete chefs |
| `chefs:*` | All chef operations |

#### Analytics Scopes
| Scope | Description |
|-------|-------------|
| `read:analytics` | View analytics data |
| `analytics:*` | All analytics operations |

#### Admin Scopes
| Scope | Description |
|-------|-------------|
| `admin:users` | Manage user accounts |
| `admin:content` | Manage site content |
| `admin:system` | Manage system settings |
| `admin:*` | Full admin access |

### Scope Groups (Common Combinations)

#### Read-Only Access
```json
["read:recipes", "read:ingredients", "read:chefs", "read:meals"]
```

#### Standard User
```json
[
  "read:recipes",
  "write:recipes",
  "read:ingredients",
  "read:meals",
  "write:meals",
  "read:collections",
  "write:collections",
  "read:inventory",
  "write:inventory"
]
```

#### Content Creator
```json
[
  "read:recipes",
  "write:recipes",
  "read:ingredients",
  "write:ingredients",
  "read:chefs",
  "write:chefs",
  "read:meals",
  "write:meals"
]
```

### Wildcard Support

Wildcards allow broad permissions:

- `recipes:*` - All recipe operations (read, write, delete)
- `*` - All operations on all resources (dangerous!)

**Example**:
```json
{
  "scopes": ["recipes:*", "meals:*"]
}
```
Grants all recipe and meal operations, but nothing else.

---

## Code Examples

### JavaScript/TypeScript

#### Using fetch

```typescript
const API_KEY = process.env.JOANIE_API_KEY!;
const BASE_URL = 'https://your-domain.com/api/v1';

async function listRecipes() {
  const response = await fetch(`${BASE_URL}/recipes`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  const result = await response.json();
  return result.data.recipes;
}

async function createRecipe(recipe: any) {
  const response = await fetch(`${BASE_URL}/recipes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(recipe)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  const result = await response.json();
  return result.data;
}
```

#### Using axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://your-domain.com/api/v1',
  headers: {
    'Authorization': `Bearer ${process.env.JOANIE_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// List recipes
const { data } = await api.get('/recipes');
console.log(data.data.recipes);

// Create recipe
const newRecipe = await api.post('/recipes', {
  name: 'Chocolate Cake',
  ingredients: ['flour', 'sugar', 'cocoa'],
  instructions: ['Mix', 'Bake']
});
console.log(newRecipe.data.data);
```

### Python

#### Using requests

```python
import os
import requests

API_KEY = os.environ['JOANIE_API_KEY']
BASE_URL = 'https://your-domain.com/api/v1'

def list_recipes():
    response = requests.get(
        f'{BASE_URL}/recipes',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        }
    )
    response.raise_for_status()
    return response.json()['data']['recipes']

def create_recipe(recipe):
    response = requests.post(
        f'{BASE_URL}/recipes',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        json=recipe
    )
    response.raise_for_status()
    return response.json()['data']

# Usage
recipes = list_recipes()
print(f'Found {len(recipes)} recipes')

new_recipe = create_recipe({
    'name': 'Chocolate Cake',
    'ingredients': ['flour', 'sugar', 'cocoa'],
    'instructions': ['Mix', 'Bake']
})
print(f'Created recipe: {new_recipe["id"]}')
```

### cURL

#### List Recipes

```bash
curl -X GET "https://your-domain.com/api/v1/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json"
```

#### Create Recipe

```bash
curl -X POST "https://your-domain.com/api/v1/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chocolate Cake",
    "ingredients": ["flour", "sugar", "cocoa"],
    "instructions": ["Mix", "Bake"],
    "prep_time": 15,
    "cook_time": 30,
    "servings": 8
  }'
```

#### Create Meal with Recipes

```bash
curl -X POST "https://your-domain.com/api/v1/meals" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunday Dinner",
    "description": "Complete family dinner",
    "meal_type": "dinner",
    "serves": 4,
    "recipes": [
      {
        "recipeId": "recipe-uuid-1",
        "courseCategory": "main",
        "servingMultiplier": 1.0
      },
      {
        "recipeId": "recipe-uuid-2",
        "courseCategory": "side",
        "servingMultiplier": 1.5
      }
    ]
  }'
```

---

## Security Best Practices

### 1. Never Expose API Keys

**Bad**:
```javascript
// ❌ NEVER do this
const apiKey = 'jk_live_abc123...'; // Hardcoded!
```

**Good**:
```javascript
// ✅ Use environment variables
const apiKey = process.env.JOANIE_API_KEY;
```

### 2. Use Minimal Scopes

Only request permissions you actually need:

**Bad**:
```json
{
  "scopes": ["*"]  // ❌ Too broad!
}
```

**Good**:
```json
{
  "scopes": ["read:recipes", "read:meals"]  // ✅ Specific
}
```

### 3. Rotate Keys Regularly

- Create new keys every 3-6 months
- Revoke old keys after migration
- Monitor usage before revoking

### 4. Use Different Keys for Different Purposes

```
Mobile App (iOS):     jk_live_abc123... (read:recipes, write:meals)
Mobile App (Android): jk_live_def456... (read:recipes, write:meals)
CI/CD Pipeline:       jk_live_ghi789... (read:recipes)
Analytics Script:     jk_live_jkl012... (read:analytics)
```

### 5. Store Keys Securely

- **Local Development**: `.env` files (add to `.gitignore`)
- **Production**: Use secret management (AWS Secrets Manager, HashiCorp Vault)
- **CI/CD**: Encrypted environment variables
- **Mobile Apps**: Secure keychain/keystore

### 6. Monitor Usage

Regularly check key usage:

```bash
curl -X GET "https://your-domain.com/api/v1/auth/keys/:id/usage" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

Look for:
- Unexpected usage patterns
- Failed requests (may indicate compromise)
- Usage from unexpected IPs

### 7. Use HTTPS Only

**Always** use HTTPS. HTTP requests will expose your API key!

**Bad**:
```
http://your-domain.com/api/v1/recipes  ❌
```

**Good**:
```
https://your-domain.com/api/v1/recipes  ✅
```

---

## Troubleshooting

### 401 Unauthorized

**Symptom**:
```json
{
  "success": false,
  "error": "Authentication required",
  "reason": "missing_auth"
}
```

**Solutions**:
1. Check `Authorization` header is present
2. Verify key format: `Bearer jk_live_...`
3. Ensure no extra spaces or newlines
4. Check key hasn't expired

### 401 Invalid API Key

**Symptom**:
```json
{
  "success": false,
  "error": "Invalid API key",
  "reason": "invalid_credentials"
}
```

**Solutions**:
1. Verify key is correct (no typos)
2. Check key hasn't been revoked
3. Verify key hasn't expired
4. Ensure using production key (`jk_live_`) for production

### 403 Insufficient Permissions

**Symptom**:
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "reason": "insufficient_scope"
}
```

**Solutions**:
1. Check required scope for endpoint
2. Update API key scopes via web interface
3. Create new key with correct scopes

### API Key Management Requires Clerk Session

**Symptom**:
```json
{
  "success": false,
  "error": "Authentication required",
  "note": "API key management requires Clerk session authentication"
}
```

**Solution**:
API key CRUD operations (create, update, delete) require Clerk session authentication. This is a security measure to prevent API keys from creating other API keys.

Use the web interface or authenticate with cookies.

---

## Next Steps

- [Test your authentication →](./TESTING_GUIDE.md)
- [Browse API endpoints →](./ENDPOINTS_REFERENCE.md)
- [View API overview →](./README.md)
