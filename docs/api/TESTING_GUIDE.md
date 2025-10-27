# API Testing Guide

Complete guide to testing the Joanie's Kitchen REST API with practical examples.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Testing with cURL](#testing-with-curl)
- [Testing with Postman](#testing-with-postman)
- [Testing with Code](#testing-with-code)
- [Complete Test Flows](#complete-test-flows)
- [Troubleshooting](#troubleshooting)
- [Common Error Scenarios](#common-error-scenarios)

---

## Prerequisites

Before testing the API, you'll need:

1. **API Key** - Create one via the web interface:
   - Login to https://your-domain.com
   - Navigate to Settings → API Keys
   - Click "Create API Key"
   - Select scopes: `read:recipes`, `write:recipes`, `read:meals`, `write:meals`
   - Copy and save the key (shown only once!)

2. **Base URL** - Your API base URL:
   ```
   https://your-domain.com/api/v1
   ```

3. **Tools** (choose one or more):
   - **cURL** (command line)
   - **Postman** or **Insomnia** (GUI)
   - **Code** (JavaScript, Python, etc.)

---

## Getting Started

### Set Your API Key

**Linux/macOS**:
```bash
export JOANIE_API_KEY="jk_live_your_key_here"
export API_BASE_URL="https://your-domain.com/api/v1"
```

**Windows (PowerShell)**:
```powershell
$env:JOANIE_API_KEY="jk_live_your_key_here"
$env:API_BASE_URL="https://your-domain.com/api/v1"
```

**Windows (Command Prompt)**:
```cmd
set JOANIE_API_KEY=jk_live_your_key_here
set API_BASE_URL=https://your-domain.com/api/v1
```

### Verify Environment Variables

```bash
echo $JOANIE_API_KEY
echo $API_BASE_URL
```

---

## Testing with cURL

cURL is a command-line tool for making HTTP requests. It's perfect for quick API testing.

### Basic GET Request

```bash
curl -X GET "$API_BASE_URL/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "recipes": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 0,
      "hasMore": false
    }
  }
}
```

### Pretty Print Response (with jq)

```bash
curl -X GET "$API_BASE_URL/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" | jq
```

### Save Response to File

```bash
curl -X GET "$API_BASE_URL/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -o recipes.json
```

### View Response Headers

```bash
curl -X GET "$API_BASE_URL/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -i
```

### POST Request (Create Recipe)

```bash
curl -X POST "$API_BASE_URL/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Recipe",
    "description": "A test recipe from API",
    "ingredients": [
      "2 cups flour",
      "1 cup sugar",
      "2 eggs"
    ],
    "instructions": [
      "Mix ingredients",
      "Bake at 350F for 30 minutes"
    ],
    "prep_time": 10,
    "cook_time": 30,
    "servings": 4,
    "difficulty": "easy",
    "is_public": false
  }'
```

### POST with JSON File

Create `recipe.json`:
```json
{
  "name": "Chocolate Chip Cookies",
  "description": "Classic cookies",
  "ingredients": [
    "2 cups all-purpose flour",
    "1 cup butter, softened",
    "3/4 cup brown sugar",
    "2 eggs",
    "2 cups chocolate chips"
  ],
  "instructions": [
    "Preheat oven to 375°F",
    "Cream butter and sugar",
    "Add eggs and mix well",
    "Gradually add flour",
    "Fold in chocolate chips",
    "Bake for 10-12 minutes"
  ],
  "prep_time": 15,
  "cook_time": 12,
  "servings": 24,
  "difficulty": "easy"
}
```

```bash
curl -X POST "$API_BASE_URL/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d @recipe.json
```

### PATCH Request (Update Recipe)

```bash
# Save recipe ID from creation
RECIPE_ID="recipe-uuid-here"

curl -X PATCH "$API_BASE_URL/recipes/$RECIPE_ID" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Recipe Name",
    "difficulty": "medium"
  }'
```

### DELETE Request

```bash
curl -X DELETE "$API_BASE_URL/recipes/$RECIPE_ID" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
```

### Query Parameters

```bash
# List recipes with filters
curl -X GET "$API_BASE_URL/recipes?page=1&limit=10&difficulty=easy&sortBy=created_at&order=desc" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json"
```

---

## Testing with Postman

Postman provides a user-friendly GUI for API testing.

### Setup

1. **Download Postman**: https://www.postman.com/downloads/
2. **Create Collection**: "Joanie's Kitchen API"
3. **Set Collection Variables**:
   - Variable: `baseUrl`
   - Initial Value: `https://your-domain.com/api/v1`
   - Variable: `apiKey`
   - Initial Value: `jk_live_your_key_here`

### Configure Authorization

**Collection Level** (applies to all requests):

1. Select collection → **Authorization** tab
2. Type: **Bearer Token**
3. Token: `{{apiKey}}`

### Create Requests

#### 1. List Recipes

- **Method**: GET
- **URL**: `{{baseUrl}}/recipes`
- **Authorization**: Inherit from collection
- **Save as**: "List Recipes"

#### 2. Create Recipe

- **Method**: POST
- **URL**: `{{baseUrl}}/recipes`
- **Authorization**: Inherit from collection
- **Body** → **raw** → **JSON**:
```json
{
  "name": "Test Recipe from Postman",
  "description": "Testing API with Postman",
  "ingredients": ["flour", "sugar", "eggs"],
  "instructions": ["Mix", "Bake"],
  "prep_time": 10,
  "cook_time": 20,
  "servings": 4
}
```
- **Save as**: "Create Recipe"

#### 3. Get Recipe by ID

- **Method**: GET
- **URL**: `{{baseUrl}}/recipes/{{recipeId}}`
- **Authorization**: Inherit from collection
- **Save as**: "Get Recipe"

**Note**: After creating a recipe, copy the `id` from response and save as collection variable `recipeId`.

#### 4. Update Recipe

- **Method**: PATCH
- **URL**: `{{baseUrl}}/recipes/{{recipeId}}`
- **Authorization**: Inherit from collection
- **Body** → **raw** → **JSON**:
```json
{
  "name": "Updated Recipe Name"
}
```
- **Save as**: "Update Recipe"

#### 5. Delete Recipe

- **Method**: DELETE
- **URL**: `{{baseUrl}}/recipes/{{recipeId}}`
- **Authorization**: Inherit from collection
- **Save as**: "Delete Recipe"

### Using Tests (Automation)

Add tests to automatically extract variables:

**Create Recipe** → **Tests** tab:
```javascript
// Parse response
const response = pm.response.json();

// Save recipe ID for later use
if (response.success && response.data) {
    pm.collectionVariables.set("recipeId", response.data.id);
    console.log("Recipe ID saved:", response.data.id);
}

// Verify response
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Response has success field", function () {
    pm.expect(response).to.have.property('success', true);
});

pm.test("Response has data", function () {
    pm.expect(response).to.have.property('data');
    pm.expect(response.data).to.have.property('id');
});
```

### Using Pre-request Scripts

**Create Recipe** → **Pre-request Scripts** tab:
```javascript
// Generate unique recipe name
const timestamp = new Date().getTime();
const recipeName = `Test Recipe ${timestamp}`;
pm.collectionVariables.set("recipeName", recipeName);
```

Then in body, use `{{recipeName}}`:
```json
{
  "name": "{{recipeName}}",
  "ingredients": ["flour", "sugar"],
  "instructions": ["Mix", "Bake"]
}
```

### Run Collection

1. Click collection → **Run**
2. Select requests to run
3. Click **Run Joanie's Kitchen API**
4. View results

---

## Testing with Code

### JavaScript/TypeScript (Node.js)

#### Using fetch

Create `test-api.js`:
```javascript
const API_KEY = process.env.JOANIE_API_KEY;
const BASE_URL = 'https://your-domain.com/api/v1';

async function testAPI() {
  try {
    // 1. List recipes
    console.log('1. Listing recipes...');
    const listResponse = await fetch(`${BASE_URL}/recipes`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const recipes = await listResponse.json();
    console.log('Found recipes:', recipes.data.recipes.length);

    // 2. Create recipe
    console.log('\n2. Creating recipe...');
    const createResponse = await fetch(`${BASE_URL}/recipes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Recipe from Node.js',
        description: 'Testing API',
        ingredients: ['flour', 'sugar', 'eggs'],
        instructions: ['Mix', 'Bake'],
        prep_time: 10,
        cook_time: 20,
        servings: 4
      })
    });
    const newRecipe = await createResponse.json();
    console.log('Created recipe:', newRecipe.data.id);

    // 3. Get recipe
    console.log('\n3. Getting recipe...');
    const getResponse = await fetch(`${BASE_URL}/recipes/${newRecipe.data.id}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const recipe = await getResponse.json();
    console.log('Recipe name:', recipe.data.name);

    // 4. Update recipe
    console.log('\n4. Updating recipe...');
    const updateResponse = await fetch(`${BASE_URL}/recipes/${newRecipe.data.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Updated Recipe Name'
      })
    });
    const updatedRecipe = await updateResponse.json();
    console.log('Updated name:', updatedRecipe.data.name);

    // 5. Delete recipe
    console.log('\n5. Deleting recipe...');
    const deleteResponse = await fetch(`${BASE_URL}/recipes/${newRecipe.data.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Deleted:', deleteResponse.ok);

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAPI();
```

Run:
```bash
node test-api.js
```

#### Using axios

Install:
```bash
npm install axios
```

Create `test-api-axios.js`:
```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'https://your-domain.com/api/v1',
  headers: {
    'Authorization': `Bearer ${process.env.JOANIE_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

async function testAPI() {
  try {
    // Create recipe
    const { data: createResult } = await api.post('/recipes', {
      name: 'Test Recipe from Axios',
      ingredients: ['flour', 'sugar'],
      instructions: ['Mix', 'Bake'],
      servings: 4
    });
    console.log('Created:', createResult.data.id);

    // Get recipe
    const { data: getResult } = await api.get(`/recipes/${createResult.data.id}`);
    console.log('Retrieved:', getResult.data.name);

    // Update recipe
    const { data: updateResult } = await api.patch(`/recipes/${createResult.data.id}`, {
      name: 'Updated Name'
    });
    console.log('Updated:', updateResult.data.name);

    // Delete recipe
    await api.delete(`/recipes/${createResult.data.id}`);
    console.log('Deleted successfully');

    console.log('\n✅ All tests passed!');
  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testAPI();
```

### Python

#### Using requests

Install:
```bash
pip install requests
```

Create `test_api.py`:
```python
import os
import requests

API_KEY = os.environ['JOANIE_API_KEY']
BASE_URL = 'https://your-domain.com/api/v1'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

def test_api():
    try:
        # 1. Create recipe
        print('1. Creating recipe...')
        create_response = requests.post(
            f'{BASE_URL}/recipes',
            headers=headers,
            json={
                'name': 'Test Recipe from Python',
                'description': 'Testing API',
                'ingredients': ['flour', 'sugar', 'eggs'],
                'instructions': ['Mix', 'Bake'],
                'prep_time': 10,
                'cook_time': 20,
                'servings': 4
            }
        )
        create_response.raise_for_status()
        recipe = create_response.json()['data']
        recipe_id = recipe['id']
        print(f'Created recipe: {recipe_id}')

        # 2. Get recipe
        print('\n2. Getting recipe...')
        get_response = requests.get(
            f'{BASE_URL}/recipes/{recipe_id}',
            headers=headers
        )
        get_response.raise_for_status()
        recipe_data = get_response.json()['data']
        print(f'Recipe name: {recipe_data["name"]}')

        # 3. Update recipe
        print('\n3. Updating recipe...')
        update_response = requests.patch(
            f'{BASE_URL}/recipes/{recipe_id}',
            headers=headers,
            json={'name': 'Updated Recipe Name'}
        )
        update_response.raise_for_status()
        updated = update_response.json()['data']
        print(f'Updated name: {updated["name"]}')

        # 4. List recipes
        print('\n4. Listing recipes...')
        list_response = requests.get(
            f'{BASE_URL}/recipes',
            headers=headers,
            params={'page': 1, 'limit': 10}
        )
        list_response.raise_for_status()
        recipes = list_response.json()['data']
        print(f'Found {len(recipes["recipes"])} recipes')

        # 5. Delete recipe
        print('\n5. Deleting recipe...')
        delete_response = requests.delete(
            f'{BASE_URL}/recipes/{recipe_id}',
            headers=headers
        )
        delete_response.raise_for_status()
        print('Deleted successfully')

        print('\n✅ All tests passed!')

    except requests.exceptions.HTTPError as e:
        print(f'❌ HTTP Error: {e}')
        print(f'Response: {e.response.json()}')
    except Exception as e:
        print(f'❌ Error: {e}')

if __name__ == '__main__':
    test_api()
```

Run:
```bash
python test_api.py
```

---

## Complete Test Flows

### Flow 1: Recipe Management

Complete workflow from creation to deletion:

```bash
#!/bin/bash

API_KEY="$JOANIE_API_KEY"
BASE_URL="https://your-domain.com/api/v1"

echo "=== Recipe Management Test Flow ==="

# 1. Create recipe
echo -e "\n1. Creating recipe..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/recipes" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Recipe",
    "ingredients": ["flour", "sugar", "eggs"],
    "instructions": ["Mix ingredients", "Bake at 350F"],
    "prep_time": 10,
    "cook_time": 20,
    "servings": 4
  }')

RECIPE_ID=$(echo $CREATE_RESPONSE | jq -r '.data.id')
echo "Created recipe: $RECIPE_ID"

# 2. Get recipe
echo -e "\n2. Getting recipe..."
curl -s -X GET "$BASE_URL/recipes/$RECIPE_ID" \
  -H "Authorization: Bearer $API_KEY" | jq '.data.name'

# 3. Update recipe
echo -e "\n3. Updating recipe..."
curl -s -X PATCH "$BASE_URL/recipes/$RECIPE_ID" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Recipe"}' | jq '.data.name'

# 4. List recipes (should include our recipe)
echo -e "\n4. Listing recipes..."
curl -s -X GET "$BASE_URL/recipes?limit=5" \
  -H "Authorization: Bearer $API_KEY" | jq '.data.pagination.total'

# 5. Delete recipe
echo -e "\n5. Deleting recipe..."
curl -s -X DELETE "$BASE_URL/recipes/$RECIPE_ID" \
  -H "Authorization: Bearer $API_KEY" | jq '.success'

echo -e "\n✅ Recipe test flow completed!"
```

### Flow 2: Meal Planning with Shopping List

Create a meal, add recipes, generate shopping list:

```bash
#!/bin/bash

API_KEY="$JOANIE_API_KEY"
BASE_URL="https://your-domain.com/api/v1"

echo "=== Meal Planning Test Flow ==="

# 1. Create first recipe
echo -e "\n1. Creating main course recipe..."
RECIPE1=$(curl -s -X POST "$BASE_URL/recipes" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Grilled Chicken",
    "ingredients": ["2 lbs chicken breast", "1 tbsp olive oil", "salt", "pepper"],
    "instructions": ["Season chicken", "Grill for 20 minutes"],
    "servings": 4
  }')
RECIPE1_ID=$(echo $RECIPE1 | jq -r '.data.id')
echo "Created main course: $RECIPE1_ID"

# 2. Create second recipe
echo -e "\n2. Creating side dish recipe..."
RECIPE2=$(curl -s -X POST "$BASE_URL/recipes" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Roasted Vegetables",
    "ingredients": ["2 cups broccoli", "1 cup carrots", "2 tbsp olive oil"],
    "instructions": ["Toss with oil", "Roast at 400F for 25 minutes"],
    "servings": 4
  }')
RECIPE2_ID=$(echo $RECIPE2 | jq -r '.data.id')
echo "Created side dish: $RECIPE2_ID"

# 3. Create meal with recipes
echo -e "\n3. Creating meal with recipes..."
MEAL=$(curl -s -X POST "$BASE_URL/meals" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Sunday Dinner\",
    \"description\": \"Complete family dinner\",
    \"meal_type\": \"dinner\",
    \"serves\": 4,
    \"recipes\": [
      {
        \"recipeId\": \"$RECIPE1_ID\",
        \"courseCategory\": \"main\",
        \"servingMultiplier\": 1.0
      },
      {
        \"recipeId\": \"$RECIPE2_ID\",
        \"courseCategory\": \"side\",
        \"servingMultiplier\": 1.0
      }
    ]
  }")
MEAL_ID=$(echo $MEAL | jq -r '.data.id')
echo "Created meal: $MEAL_ID"

# 4. Generate shopping list
echo -e "\n4. Generating shopping list..."
SHOPPING_LIST=$(curl -s -X POST "$BASE_URL/meals/$MEAL_ID/shopping-list" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json")
SHOPPING_LIST_ID=$(echo $SHOPPING_LIST | jq -r '.data.id')
echo "Generated shopping list: $SHOPPING_LIST_ID"

# 5. Get shopping list
echo -e "\n5. Getting shopping list..."
curl -s -X GET "$BASE_URL/meals/$MEAL_ID/shopping-list" \
  -H "Authorization: Bearer $API_KEY" | jq '.data.items[] | .name'

# 6. Cleanup
echo -e "\n6. Cleaning up..."
curl -s -X DELETE "$BASE_URL/meals/$MEAL_ID" \
  -H "Authorization: Bearer $API_KEY" > /dev/null
curl -s -X DELETE "$BASE_URL/recipes/$RECIPE1_ID" \
  -H "Authorization: Bearer $API_KEY" > /dev/null
curl -s -X DELETE "$BASE_URL/recipes/$RECIPE2_ID" \
  -H "Authorization: Bearer $API_KEY" > /dev/null

echo -e "\n✅ Meal planning test flow completed!"
```

### Flow 3: API Key Management

Test API key operations (requires Clerk session):

```bash
#!/bin/bash

# Note: This requires Clerk session cookies
COOKIES_FILE="cookies.txt"
BASE_URL="https://your-domain.com/api/v1"

echo "=== API Key Management Test Flow ==="

# 1. List existing keys
echo -e "\n1. Listing API keys..."
curl -s -X GET "$BASE_URL/auth/keys" \
  -b "$COOKIES_FILE" | jq '.data[] | {name: .name, scopes: .scopes}'

# 2. Create new API key
echo -e "\n2. Creating new API key..."
NEW_KEY=$(curl -s -X POST "$BASE_URL/auth/keys" \
  -b "$COOKIES_FILE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Key",
    "scopes": ["read:recipes", "write:recipes"],
    "description": "Temporary test key"
  }')

KEY_ID=$(echo $NEW_KEY | jq -r '.data.id')
API_KEY=$(echo $NEW_KEY | jq -r '.data.apiKey')
echo "Created key: $KEY_ID"
echo "API Key: $API_KEY"

# 3. Test the new key
echo -e "\n3. Testing new API key..."
curl -s -X GET "$BASE_URL/recipes?limit=1" \
  -H "Authorization: Bearer $API_KEY" | jq '.success'

# 4. Get key details
echo -e "\n4. Getting key details..."
curl -s -X GET "$BASE_URL/auth/keys/$KEY_ID" \
  -b "$COOKIES_FILE" | jq '.data | {name: .name, totalRequests: .totalRequests}'

# 5. Update key
echo -e "\n5. Updating key..."
curl -s -X PATCH "$BASE_URL/auth/keys/$KEY_ID" \
  -b "$COOKIES_FILE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test Key"
  }' | jq '.data.name'

# 6. Get usage stats
echo -e "\n6. Getting usage statistics..."
curl -s -X GET "$BASE_URL/auth/keys/$KEY_ID/usage" \
  -H "Authorization: Bearer $API_KEY" | jq '.data.totalRequests'

# 7. Revoke key
echo -e "\n7. Revoking key..."
curl -s -X DELETE "$BASE_URL/auth/keys/$KEY_ID" \
  -b "$COOKIES_FILE" | jq '.success'

echo -e "\n✅ API key management test flow completed!"
```

---

## Troubleshooting

### Common Issues

#### 1. "Authentication required"

**Problem**:
```json
{
  "success": false,
  "error": "Authentication required",
  "reason": "missing_auth"
}
```

**Solutions**:
- Verify `Authorization` header is present
- Check format: `Bearer jk_live_...` (note the space)
- Ensure API key is set in environment variable
- Try echoing the variable: `echo $JOANIE_API_KEY`

#### 2. "Invalid API key"

**Problem**:
```json
{
  "success": false,
  "error": "Invalid API key",
  "reason": "invalid_credentials"
}
```

**Solutions**:
- Check for typos in API key
- Verify key hasn't been revoked
- Check key hasn't expired
- Ensure using production key for production environment

#### 3. "Insufficient permissions"

**Problem**:
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "reason": "insufficient_scope"
}
```

**Solutions**:
- Check endpoint's required scope
- Verify API key has necessary scopes
- Create new key with correct scopes
- Example: `write:recipes` needed for POST/PATCH/DELETE on recipes

#### 4. "Invalid request body"

**Problem**:
```json
{
  "success": false,
  "error": "Invalid request body",
  "details": [...]
}
```

**Solutions**:
- Check JSON syntax is valid
- Verify all required fields are present
- Check field types match schema
- Review endpoint reference for correct schema

#### 5. CORS Errors (Browser)

**Problem**:
```
Access to fetch at 'https://...' from origin 'http://localhost:3000' has been blocked by CORS
```

**Solutions**:
- Use API keys from server-side only (never in browser)
- For web apps, use Clerk session authentication
- CORS is intentionally restricted for security

---

## Common Error Scenarios

### Test Authentication Failures

```bash
# Missing Authorization header
curl -X GET "$API_BASE_URL/recipes"
# ❌ 401: Authentication required

# Invalid API key format
curl -X GET "$API_BASE_URL/recipes" \
  -H "Authorization: jk_live_abc123"  # Missing "Bearer"
# ❌ 401: Invalid format

# Expired or revoked key
curl -X GET "$API_BASE_URL/recipes" \
  -H "Authorization: Bearer jk_live_expired"
# ❌ 401: Invalid API key
```

### Test Validation Errors

```bash
# Missing required fields
curl -X POST "$API_BASE_URL/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'  # Missing ingredients and instructions
# ❌ 400: Invalid request body

# Invalid field types
curl -X POST "$API_BASE_URL/recipes" \
  -H "Authorization: Bearer $JOANIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "ingredients": ["flour"],
    "instructions": ["bake"],
    "servings": "four"  # Should be number, not string
  }'
# ❌ 400: Invalid request body
```

### Test Permission Errors

```bash
# API key with only read:recipes trying to write
curl -X POST "$API_BASE_URL/recipes" \
  -H "Authorization: Bearer $READ_ONLY_KEY" \
  -H "Content-Type: application/json" \
  -d '{...}'
# ❌ 403: Insufficient permissions

# Trying to access another user's private resource
curl -X GET "$API_BASE_URL/recipes/other-user-recipe-id" \
  -H "Authorization: Bearer $JOANIE_API_KEY"
# ❌ 403: Access denied
```

---

## Next Steps

- [View complete endpoint reference →](./ENDPOINTS_REFERENCE.md)
- [Learn about authentication →](./AUTHENTICATION.md)
- [Return to API overview →](./README.md)

---

**Happy Testing!** 🎉
