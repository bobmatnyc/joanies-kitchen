# Admin Edit UI System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Recipe Page (Client)                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              AdminEditModeProvider (Context)                  │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  editMode: boolean                                      │  │  │
│  │  │  toggleEditMode(): void                                 │  │  │
│  │  │  setEditMode(mode: boolean): void                       │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  ┌──────────────────────────┐  ┌──────────────────────────┐  │  │
│  │  │  AdminContentActions     │  │  RecipeContentWithEdit   │  │  │
│  │  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │  │  │
│  │  │  │ [Edit Mode] Toggle │  │  │  │ Ingredients Card   │  │  │  │
│  │  │  │ ├─ Enable/Exit    │  │  │  │ ├─ [Edit] Button  │  │  │  │
│  │  │  │ └─ Visual Indicator│  │  │  │ └─ Opens Editor   │  │  │  │
│  │  │  └────────────────────┘  │  │  └────────────────────┘  │  │  │
│  │  │                           │  │  ┌────────────────────┐  │  │  │
│  │  │  [Flag Image]             │  │  │ Instructions Card  │  │  │  │
│  │  │  [Flag Ingredients]       │  │  │ ├─ [Edit] Button  │  │  │  │
│  │  │  [Flag Instructions]      │  │  │ └─ Opens Editor   │  │  │  │
│  │  │  [Soft Delete]            │  │  └────────────────────┘  │  │  │
│  │  └──────────────────────────┘  └──────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

                              │
                              │ User Actions
                              ▼

┌─────────────────────────────────────────────────────────────────────┐
│                      Editor Overlays (Client)                       │
│                                                                     │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌────────────┐ │
│  │ IngredientEditor   │  │ InstructionEditor    │  │ImageEditor │ │
│  │ (Sheet Overlay)    │  │ (Sheet Overlay)      │  │(Dialog)    │ │
│  │                    │  │                      │  │            │ │
│  │ [↑↓] Input [🗑️]   │  │ Step 1: [Textarea]   │  │ [Preview]  │ │
│  │ [↑↓] Input [🗑️]   │  │ [↑↓] [🗑️]            │  │            │ │
│  │ [↑↓] Input [🗑️]   │  │ Step 2: [Textarea]   │  │ [Regen AI] │ │
│  │                    │  │ [↑↓] [🗑️]            │  │ [Upload]   │ │
│  │ [+ Add]            │  │                      │  │            │ │
│  │ [Parse with AI]    │  │ [+ Add Step]         │  │ [Close]    │ │
│  │                    │  │ [Format with AI]     │  │            │ │
│  │ [Cancel] [Save]    │  │                      │  │            │ │
│  │                    │  │ [Cancel] [Save]      │  │            │ │
│  └─────────────────────┘  └──────────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

                              │
                              │ Server Actions
                              ▼

┌─────────────────────────────────────────────────────────────────────┐
│                  Server Actions (admin-edit.ts)                     │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────┐  │
│  │ updateRecipe         │  │ LLM Processing       │  │ Image    │  │
│  │ Ingredients()        │  │                      │  │ Ops      │  │
│  │ ├─ Validate         │  │ parseIngredients     │  │          │  │
│  │ ├─ Update DB        │  │ WithLLM()            │  │ upload   │  │
│  │ └─ Revalidate       │  │ ├─ Save current     │  │ Recipe   │  │
│  │                      │  │ ├─ Call OpenRouter  │  │ Image()  │  │
│  │ updateRecipe         │  │ ├─ Parse response   │  │          │  │
│  │ Instructions()       │  │ └─ Update & return  │  │ regen    │  │
│  │ ├─ Validate         │  │                      │  │ Image()  │  │
│  │ ├─ Update DB        │  │ formatInstructions   │  │          │  │
│  │ └─ Revalidate       │  │ WithLLM()            │  │          │  │
│  │                      │  │ ├─ Save current     │  │          │  │
│  │                      │  │ ├─ Call OpenRouter  │  │          │  │
│  │                      │  │ ├─ Parse response   │  │          │  │
│  │                      │  │ └─ Update & return  │  │          │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘

                              │
                              │ Database/API Calls
                              ▼

┌─────────────────────────────────────────────────────────────────────┐
│                      External Services                              │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────┐  │
│  │ Neon PostgreSQL      │  │ OpenRouter API       │  │ Next.js  │  │
│  │ (via Drizzle ORM)    │  │                      │  │ Cache    │  │
│  │                      │  │ Claude 3.5 Sonnet    │  │          │  │
│  │ recipes table        │  │ ├─ Ingredient parse  │  │ revalid  │  │
│  │ ├─ ingredients       │  │ ├─ Instruction fmt   │  │ atePath  │  │
│  │ ├─ instructions      │  │ └─ Temperature: 0.3  │  │ ()       │  │
│  │ ├─ image_url         │  │                      │  │          │  │
│  │ └─ updated_at        │  │ DALL-E 3             │  │          │  │
│  │                      │  │ └─ Image generation  │  │          │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Edit Ingredient Flow

```
User Action                  Client Component              Server Action                Database
────────────────────────────────────────────────────────────────────────────────────────────────

1. Click [Edit]      →      IngredientEditor
   on Ingredients            opens (Sheet)

2. Modify ingredients →     Local state
   (add/remove/edit)         updated

3. Click                →   Save handler
   [Parse with AI]           calls server

                             ├─ updateRecipe          →  recipes.ingredients
                             │  Ingredients()             UPDATE

                             └─ parseIngredients
                                WithLLM()
                                                      →  OpenRouter API
                                ├─ Build prompt          (Claude 3.5 Sonnet)
                                ├─ Call LLM
                                ├─ Parse JSON response
                                └─ updateRecipe       →  recipes.ingredients
                                   Ingredients()          UPDATE

                             ← Return parsed data

4. Display updated   ←      Set local state
   ingredients               with LLM results

5. Click [Save]      →      Save handler
                             calls server

                             └─ updateRecipe          →  recipes.ingredients
                                Ingredients()             UPDATE
                                                       →  revalidatePath()

                             ← Success response

6. Page refresh      ←      window.location
                             .reload()

                                                          Next.js serves
                                                          updated data
```

### Edit Instruction Flow

```
User Action                  Client Component              Server Action                Database
────────────────────────────────────────────────────────────────────────────────────────────────

1. Click [Edit]      →      InstructionEditor
   on Instructions           opens (Sheet)

2. Modify steps      →      Local state
   (add/remove/edit)         updated

3. Click                →   Save handler
   [Format with AI]          calls server

                             ├─ updateRecipe          →  recipes.instructions
                             │  Instructions()            UPDATE

                             └─ formatInstructions
                                WithLLM()
                                                      →  OpenRouter API
                                ├─ Build prompt          (Claude 3.5 Sonnet)
                                ├─ Call LLM
                                ├─ Parse JSON response
                                └─ updateRecipe       →  recipes.instructions
                                   Instructions()         UPDATE

                             ← Return formatted data

4. Display updated   ←      Set local state
   instructions              with LLM results

5. Click [Save]      →      Save handler
                             calls server

                             └─ updateRecipe          →  recipes.instructions
                                Instructions()            UPDATE
                                                       →  revalidatePath()

                             ← Success response

6. Page refresh      ←      window.location
                             .reload()

                                                          Next.js serves
                                                          updated data
```

### Regenerate Image Flow

```
User Action                  Client Component              Server Action                Database/API
────────────────────────────────────────────────────────────────────────────────────────────────

1. Click [Regen AI]  →      ImageEditor
                             calls server

                             └─ regenerateImage()
                                                      →  recipes.image_flagged
                                ├─ Flag image            = true UPDATE

                                └─ regenerateRecipe   →  OpenRouter API
                                   Image()               (DALL-E 3)
                                   ├─ Get recipe
                                   ├─ Build prompt
                                   ├─ Call DALL-E
                                   ├─ Get image URL
                                   └─ Update recipe   →  recipes.image_url
                                                         recipes.images
                                                         UPDATE
                                                      →  revalidatePath()

                             ← Success with new URL

2. Close dialog      ←      onSave() callback

3. Page refresh      ←      window.location
                             .reload()

                                                          Next.js serves
                                                          updated image
```

## Component Hierarchy

```
RecipePage
└── AdminEditModeProvider
    ├── [Recipe Header]
    ├── [Tool Buttons Row]
    │   └── AdminContentActions
    │       └── [Edit Mode Toggle]
    ├── [Recipe Metadata]
    ├── [Images]
    └── RecipeContentWithEdit
        ├── [Ingredients Card]
        │   └── [Edit Button] (if editMode && isAdmin)
        ├── [Instructions Card]
        │   └── [Edit Button] (if editMode && isAdmin)
        ├── IngredientEditor (Sheet)
        │   ├── [Ingredient List]
        │   ├── [Parse with AI]
        │   └── [Save/Cancel]
        ├── InstructionEditor (Sheet)
        │   ├── [Step List]
        │   ├── [Format with AI]
        │   └── [Save/Cancel]
        └── ImageEditor (Dialog)
            ├── [Image Preview]
            ├── [Regenerate with AI]
            ├── [Upload New Image]
            └── [Close]
```

## State Management

### Global State (React Context)

```typescript
// AdminEditModeProvider
{
  editMode: boolean,        // Is edit mode currently active?
  setEditMode: (mode) => void,
  toggleEditMode: () => void
}
```

### Local State (Component Level)

```typescript
// IngredientEditor
{
  ingredients: string[],    // Current ingredient list
  saving: boolean,          // Is save operation in progress?
  parsing: boolean          // Is AI parsing in progress?
}

// InstructionEditor
{
  instructions: string[],   // Current instruction list
  saving: boolean,          // Is save operation in progress?
  formatting: boolean       // Is AI formatting in progress?
}

// ImageEditor
{
  regenerating: boolean,    // Is AI regeneration in progress?
  uploading: boolean,       // Is file upload in progress?
  previewUrl: string | null // Preview of uploaded image
}

// RecipeContentWithEdit
{
  ingredientsEditorOpen: boolean,
  instructionsEditorOpen: boolean,
  imageEditorOpen: boolean,
  key: number              // Forces re-render after save
}
```

## Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        Security Layers                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: UI Visibility                                         │
│  ├─ AdminContentActions: Only renders for admin users          │
│  ├─ Edit buttons: Only render when (isAdmin && editMode)       │
│  └─ Editor overlays: Only render for admin users               │
│                                                                 │
│  Layer 2: Client-Side Checks                                    │
│  ├─ useAdminEditMode(): Context only accessible in provider    │
│  └─ Component props: isAdmin passed explicitly                 │
│                                                                 │
│  Layer 3: Server-Side Enforcement                               │
│  ├─ requireAdmin(): All server actions check admin status      │
│  ├─ Throws error if not admin (401 Unauthorized)               │
│  └─ Reads users.is_admin for the session user                  │
│                                                                 │
│  Layer 4: Database Constraints                                  │
│  ├─ All updates scoped to specific recipe ID                   │
│  ├─ Timestamps automatically updated (updated_at)              │
│  └─ Drizzle ORM prevents SQL injection                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Error Handling Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                      Error Handling Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Client-Side Errors                                             │
│  ├─ Validation Errors                                           │
│  │  ├─ Empty ingredient/instruction list                        │
│  │  ├─ Invalid file type (image upload)                         │
│  │  └─ File size too large (>5MB)                               │
│  │  └─ Action: Show toast.error(), prevent submission           │
│  │                                                               │
│  ├─ Network Errors                                               │
│  │  ├─ Server action fails                                       │
│  │  ├─ LLM API timeout                                           │
│  │  └─ Action: Show toast.error(), keep data, allow retry       │
│  │                                                               │
│  └─ User Errors                                                  │
│     ├─ Click save without changes                               │
│     └─ Action: Allow (idempotent operation)                     │
│                                                                 │
│  Server-Side Errors                                             │
│  ├─ Authentication Errors                                        │
│  │  ├─ Not logged in                                             │
│  │  ├─ Not admin                                                 │
│  │  └─ Action: Return {success: false, error: "message"}        │
│  │                                                               │
│  ├─ Database Errors                                              │
│  │  ├─ Recipe not found                                          │
│  │  ├─ Update fails                                              │
│  │  └─ Action: Log error, return {success: false, error}        │
│  │                                                               │
│  ├─ LLM Errors                                                   │
│  │  ├─ API rate limit                                            │
│  │  ├─ Invalid response format                                   │
│  │  ├─ Model unavailable                                         │
│  │  └─ Action: Log error, return {success: false, error}        │
│  │                                                               │
│  └─ Validation Errors                                            │
│     ├─ Invalid data type                                         │
│     ├─ Empty arrays                                              │
│     └─ Action: Return {success: false, error: "message"}        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Performance Considerations

### Client-Side Optimizations
- Lazy loading of editor components (future)
- Debounced input fields (future)
- React.memo for expensive components (future)
- Local state management (no global state pollution)

### Server-Side Optimizations
- Single database queries (no N+1 problems)
- Selective field updates (only changed fields)
- Path revalidation (specific paths, not global)
- LLM caching (OpenRouter handles this)

### Network Optimizations
- Minimal payload sizes (JSON arrays only)
- No unnecessary re-fetches
- Page reload ensures cache consistency

### Trade-offs
- Page reload vs. optimistic updates
  - Current: Page reload (simple, consistent)
  - Future: Optimistic updates (better UX, more complex)

---

## Integration Checklist

### Frontend Integration
- [x] AdminEditModeProvider wraps recipe page
- [x] AdminContentActions includes edit mode toggle
- [x] RecipeContentWithEdit replaces static content
- [x] Edit buttons appear on hover (desktop) / always (mobile)
- [x] All editors use Sheet/Dialog overlays
- [x] Mobile-friendly touch targets (44x44px)

### Backend Integration
- [x] Server actions in admin-edit.ts
- [x] All actions require admin authentication
- [x] Database updates with Drizzle ORM
- [x] Path revalidation after saves
- [x] LLM integration via OpenRouter
- [x] Error handling and validation

### Security Integration
- [x] requireAdmin() checks on all server actions
- [x] UI visibility controlled by isAdmin prop
- [x] Edit mode state managed via Context
- [x] Database constraints prevent unauthorized changes

### Testing Integration
- [ ] Unit tests for server actions
- [ ] Component tests for editors
- [ ] Integration tests for edit flow
- [ ] E2E tests for admin workflow

---

**Last Updated**: 2025-10-18
**Version**: 0.5.0
