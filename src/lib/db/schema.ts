import { randomUUID } from 'node:crypto';
import {
  boolean,
  customType,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { chefs } from './chef-schema';

// Re-export chefs for types.ts
export { chefs };

// ====================
// RECIPE LICENSE ONTOLOGY
// ====================
/**
 * Recipe License Types - Defines usage rights and restrictions for recipes
 *
 * License Types:
 * - PUBLIC_DOMAIN: No copyright restrictions, free to use for any purpose
 * - CC_BY: Creative Commons Attribution - Free to use with attribution
 * - CC_BY_SA: CC Attribution-ShareAlike - Free to use with attribution, derivative works must use same license
 * - CC_BY_NC: CC Attribution-NonCommercial - Free for non-commercial use with attribution
 * - CC_BY_NC_SA: CC Attribution-NonCommercial-ShareAlike - Non-commercial use with attribution, same license for derivatives
 * - EDUCATIONAL_USE: Restricted to educational purposes only
 * - PERSONAL_USE: Restricted to personal, non-commercial use only
 * - ALL_RIGHTS_RESERVED: Full copyright protection, requires permission for use
 * - FAIR_USE: Content used under fair use doctrine (news, commentary, education)
 *
 * Default: ALL_RIGHTS_RESERVED (most restrictive, safest default for imported content)
 */
export const recipeLicenseEnum = pgEnum('recipe_license', [
  'PUBLIC_DOMAIN',
  'CC_BY',
  'CC_BY_SA',
  'CC_BY_NC',
  'CC_BY_NC_SA',
  'EDUCATIONAL_USE',
  'PERSONAL_USE',
  'ALL_RIGHTS_RESERVED',
  'FAIR_USE',
]);

// Custom type for pgvector embedding columns
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(384)';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    if (typeof value === 'string') {
      // Handle pgvector format: '[0.1,0.2,0.3]' or '[0.1, 0.2, 0.3]'
      const cleaned = value.replace(/[[\]]/g, '');
      return cleaned.split(',').map(Number);
    }
    return value as any;
  },
});

// ====================
// RECIPE SOURCES ONTOLOGY (2-level hierarchy)
// ====================

// Recipe Sources (Top Level) - Where recipes and chefs come from
export const recipeSources = pgTable(
  'recipe_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(), // e.g., "Serious Eats", "TheMealDB", "User Generated"
    slug: text('slug').notNull().unique(), // URL-friendly: serious-eats, themealdb
    website_url: text('website_url'), // Optional website URL
    logo_url: text('logo_url'), // Optional logo URL
    description: text('description'), // Description of the source
    is_active: boolean('is_active').notNull().default(true), // Can deactivate without deleting
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: index('recipe_sources_slug_idx').on(table.slug),
    isActiveIdx: index('recipe_sources_is_active_idx').on(table.is_active),
  })
);

// Recipe Source Types (2nd Level) - Categories/types within each source
export const recipeSourceTypes = pgTable(
  'recipe_source_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source_id: uuid('source_id')
      .notNull()
      .references(() => recipeSources.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g., "Web Scrape", "API", "Manual Entry", "Chef Profile"
    description: text('description'), // Description of the source type
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    sourceIdIdx: index('recipe_source_types_source_id_idx').on(table.source_id),
    uniqueSourceType: unique('unique_source_type').on(table.source_id, table.name),
  })
);

// Recipes table with authentication support
export const recipes = pgTable(
  'recipes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    user_id: text('user_id').notNull(), // Clerk user ID
    chef_id: uuid('chef_id').references(() => chefs.id, { onDelete: 'set null' }), // Optional reference to chef (for chef-attributed recipes)
    source_id: uuid('source_id').references(() => recipeSources.id, { onDelete: 'set null' }), // Optional reference to recipe source
    name: text('name').notNull(),
    description: text('description'),
    ingredients: text('ingredients').notNull(), // JSON array of strings
    instructions: text('instructions').notNull(), // JSON array of strings
    prep_time: integer('prep_time'), // in minutes
    cook_time: integer('cook_time'), // in minutes
    servings: integer('servings'),
    difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }),
    cuisine: text('cuisine'),
    tags: text('tags'), // JSON array of strings
    image_url: text('image_url'), // External URL only (deprecated - kept for backwards compatibility)
    images: text('images'), // JSON array of image URLs (up to 6)
    is_ai_generated: boolean('is_ai_generated').default(false),
    is_public: boolean('is_public').default(false), // Recipe visibility
    is_system_recipe: boolean('is_system_recipe').default(false), // System/curated recipes
    is_meal_prep_friendly: boolean('is_meal_prep_friendly').default(false), // Meal prep suitability
    nutrition_info: text('nutrition_info'), // JSON object with nutritional data
    model_used: text('model_used'), // AI model used for generation
    source: text('source'), // Recipe source (URL, chef name, etc.)

    // License and usage rights
    license: recipeLicenseEnum('license').notNull().default('ALL_RIGHTS_RESERVED'), // Recipe usage rights and restrictions

    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),

    // Enhanced provenance tracking fields
    search_query: text('search_query'), // Search query that discovered this recipe
    discovery_date: timestamp('discovery_date', { withTimezone: true }), // When recipe was discovered
    confidence_score: decimal('confidence_score', { precision: 3, scale: 2 }), // Validation confidence (0.00-1.00)
    validation_model: text('validation_model'), // AI model used for validation
    embedding_model: text('embedding_model'), // Embedding model name for vector search

    // Week tracking for weekly recipe discovery
    discovery_week: integer('discovery_week'), // ISO week number (1-52) when discovered
    discovery_year: integer('discovery_year'), // Year when discovered
    published_date: timestamp('published_date'), // Original publication date from source

    // Recipe ratings
    system_rating: decimal('system_rating', { precision: 2, scale: 1 }), // AI-generated quality score (0.0-5.0)
    system_rating_reason: text('system_rating_reason'), // Explanation of AI rating
    avg_user_rating: decimal('avg_user_rating', { precision: 2, scale: 1 }), // Average user rating
    total_user_ratings: integer('total_user_ratings').default(0), // Count of user ratings

    // SEO slug for friendly URLs
    slug: varchar('slug', { length: 255 }).unique(), // SEO-friendly URL slug (e.g., "grandmas-chocolate-chip-cookies")

    // Video URL for recipe tutorials (e.g., YouTube, Vimeo, Tasty)
    video_url: text('video_url'), // Optional video tutorial URL

    // Admin image flagging and regeneration
    image_flagged_for_regeneration: boolean('image_flagged_for_regeneration').default(false),
    image_regeneration_requested_at: timestamp('image_regeneration_requested_at'),
    image_regeneration_requested_by: text('image_regeneration_requested_by'), // Admin user ID who flagged

    // Admin content cleanup flags
    content_flagged_for_cleanup: boolean('content_flagged_for_cleanup').default(false),
    ingredients_need_cleanup: boolean('ingredients_need_cleanup').default(false),
    instructions_need_cleanup: boolean('instructions_need_cleanup').default(false),

    // Soft delete support
    deleted_at: timestamp('deleted_at'), // When recipe was soft-deleted
    deleted_by: text('deleted_by'), // Admin user ID who soft-deleted

    // Social engagement metrics (denormalized for performance)
    like_count: integer('like_count').default(0).notNull(), // Total likes from recipeLikes table
    fork_count: integer('fork_count').default(0).notNull(), // Times this recipe has been cloned
    collection_count: integer('collection_count').default(0).notNull(), // Times added to collections

    // Instruction classification metadata (AI-powered step analysis)
    instruction_metadata: text('instruction_metadata'), // JSONB array of InstructionMetadata
    instruction_metadata_version: varchar('instruction_metadata_version', { length: 20 }), // Schema version (e.g., "1.0.0")
    instruction_metadata_generated_at: timestamp('instruction_metadata_generated_at'), // When classification was done
    instruction_metadata_model: varchar('instruction_metadata_model', { length: 100 }), // Model used (e.g., "google/gemini-2.0-flash-exp:free")

    // Meal Pairing Metadata (v0.65.0) - for sophisticated multi-course meal planning
    weight_score: integer('weight_score'), // Dish heaviness (1-5): 1=light salad, 5=heavy stew
    richness_score: integer('richness_score'), // Fat/oil content (1-5): 1=lean, 5=rich/fatty
    acidity_score: integer('acidity_score'), // Acidic components (1-5): 1=neutral, 5=very acidic
    sweetness_level: text('sweetness_level', { enum: ['light', 'moderate', 'rich'] }), // For desserts and sweet components
    dominant_textures: text('dominant_textures'), // JSON array: ["crispy", "creamy", "crunchy", "soft", "flaky", "smooth"]
    dominant_flavors: text('dominant_flavors'), // JSON array: ["umami", "sweet", "salty", "bitter", "sour", "spicy"]
    serving_temperature: text('serving_temperature', { enum: ['hot', 'cold', 'room'] }), // Serving temperature
    pairing_rationale: text('pairing_rationale'), // Why this pairs well in a multi-course meal

    // Waste-Reduction and Resourcefulness Fields (v0.45.0 - Zero-Waste Pivot)
    resourcefulness_score: integer('resourcefulness_score'), // 1-5 scale: How resourceful/waste-conscious this recipe is
    waste_reduction_tags: text('waste_reduction_tags'), // JSON array: ["uses-scraps", "one-pot", "flexible-ingredients", "minimal-waste", "uses-aging", "seasonal"]
    scrap_utilization_notes: text('scrap_utilization_notes'), // Tips on using scraps/leftovers: "Save chicken bones for stock"
    environmental_notes: text('environmental_notes'), // Environmental impact notes: "Uses seasonal ingredients to reduce carbon footprint"

    // QA Tracking Fields (v0.7.1 - Phase 6 Launch Preparation)
    // Purpose: Track recipe quality assurance validation for 4,707 recipes
    // Workflow: pending → validated (success) | pending → flagged (issues) → fixed (auto-fix) | flagged → needs_review (human) → validated
    qa_status: varchar('qa_status', { length: 50 }).default('pending'), // 'pending', 'validated', 'flagged', 'fixed', 'needs_review'
    qa_timestamp: timestamp('qa_timestamp'), // When QA was last performed (null = never QA'd)
    qa_method: varchar('qa_method', { length: 100 }), // 'human', 'qwen2.5-7b-instruct', 'gpt-4o-mini', 'automated-rules', etc.
    qa_confidence: decimal('qa_confidence', { precision: 3, scale: 2 }), // 0.00-1.00 confidence score (null for human/automated rules)
    qa_notes: text('qa_notes'), // Free-form human notes or validation details
    qa_issues_found: text('qa_issues_found'), // JSON array: ["missing_ingredient:salt", "instruction_mismatch:butter"]
    qa_fixes_applied: text('qa_fixes_applied'), // JSON array: ["added_ingredient:salt", "updated_quantity:2_cups_flour"]

    // Recipe Moderation Fields (Admin Moderation Queue Workflow)
    // Purpose: Track moderation status for user-uploaded recipes before public visibility
    // Workflow: pending → approved (visible) | pending → rejected (not visible) | approved → flagged (investigation needed)
    moderation_status: text('moderation_status', {
      enum: ['pending', 'approved', 'rejected', 'flagged'],
    })
      .notNull()
      .default('pending'), // Default to pending for user-uploaded recipes
    moderation_notes: text('moderation_notes'), // Admin notes about rejection/flagging reasons
    moderated_by: text('moderated_by'), // Clerk user ID of moderator who took action
    moderated_at: timestamp('moderated_at'), // When moderation action was taken
    submission_notes: text('submission_notes'), // User's notes when submitting recipe for review
  },
  (table) => ({
    // Performance indexes for pagination and filtering
    ratingIdx: index('idx_recipes_rating').on(
      table.system_rating.desc(),
      table.avg_user_rating.desc()
    ),
    createdIdx: index('idx_recipes_created').on(table.created_at.desc()),
    userPublicIdx: index('idx_recipes_user_public').on(table.user_id, table.is_public),
    systemIdx: index('idx_recipes_system').on(table.is_system_recipe),
    cuisineIdx: index('idx_recipes_cuisine').on(table.cuisine),
    difficultyIdx: index('idx_recipes_difficulty').on(table.difficulty),
    publicSystemIdx: index('idx_recipes_public_system').on(table.is_public, table.is_system_recipe),
    discoveryWeekIdx: index('idx_recipes_discovery_week').on(
      table.discovery_year,
      table.discovery_week
    ),
    slugIdx: index('idx_recipes_slug').on(table.slug), // Index for slug-based lookups
    flaggedImageIdx: index('idx_recipes_flagged_images').on(table.image_flagged_for_regeneration),
    flaggedContentIdx: index('idx_recipes_flagged_content').on(table.content_flagged_for_cleanup),
    deletedAtIdx: index('idx_recipes_deleted_at').on(table.deleted_at),
    engagementIdx: index('idx_recipes_engagement').on(
      table.like_count.desc(),
      table.fork_count.desc(),
      table.collection_count.desc()
    ), // Index for sorting by engagement
    instructionMetadataIdx: index('idx_recipes_instruction_metadata').on(
      table.instruction_metadata
    ), // GIN index for JSONB queries (created via SQL)
    pairingMetadataIdx: index('idx_recipes_pairing_metadata').on(
      table.weight_score,
      table.richness_score,
      table.acidity_score
    ), // Composite index for meal pairing queries
    servingTempIdx: index('idx_recipes_serving_temp').on(table.serving_temperature), // Index for temperature-based filtering
    licenseIdx: index('idx_recipes_license').on(table.license), // Index for license-based filtering
    qaStatusIdx: index('idx_recipes_qa_status').on(table.qa_status), // Index for QA status filtering
    qaTimestampIdx: index('idx_recipes_qa_timestamp').on(table.qa_timestamp), // Index for QA timestamp sorting
    qaMethodIdx: index('idx_recipes_qa_method').on(table.qa_method), // Index for QA method filtering
    moderationStatusIdx: index('idx_recipes_moderation_status').on(table.moderation_status), // Index for moderation queue filtering
    moderationPendingIdx: index('idx_recipes_moderation_pending').on(
      table.moderation_status,
      table.created_at.desc()
    ), // Composite index for pending queue sorted by submission time
  })
);

// Recipe Embeddings table for vector similarity search
export const recipeEmbeddings = pgTable(
  'recipe_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    embedding: vector('embedding').notNull(),
    embedding_text: text('embedding_text').notNull(),
    model_name: varchar('model_name', { length: 100 }).notNull().default('all-MiniLM-L6-v2'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    // Unique constraint: one embedding per recipe
    recipeIdUnique: unique('recipe_embeddings_recipe_id_unique').on(table.recipe_id),
  })
);

// Recipe Ratings table for individual user ratings
export const recipeRatings = pgTable(
  'recipe_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    user_id: text('user_id').notNull(), // Clerk user ID
    rating: integer('rating').notNull(), // 0-5 star rating
    review: text('review'), // Optional review text
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    // Unique constraint: one rating per user per recipe
    recipeUserUnique: unique().on(table.recipe_id, table.user_id),
    // Indexes for efficient queries
    recipeIdIdx: index('recipe_ratings_recipe_id_idx').on(table.recipe_id),
    userIdIdx: index('recipe_ratings_user_id_idx').on(table.user_id),
  })
);

// Recipe Flags table for content moderation
export const recipeFlags = pgTable(
  'recipe_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    user_id: text('user_id').notNull(), // Clerk user ID of reporter
    reason: text('reason', {
      enum: ['inappropriate', 'spam', 'copyright', 'quality', 'other'],
    }).notNull(),
    description: text('description'), // Optional detailed explanation
    status: text('status', {
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    })
      .notNull()
      .default('pending'),
    reviewed_by: text('reviewed_by'), // Admin user ID who reviewed
    reviewed_at: timestamp('reviewed_at'),
    review_notes: text('review_notes'), // Admin notes on review
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    // Indexes for efficient queries
    recipeIdIdx: index('recipe_flags_recipe_id_idx').on(table.recipe_id),
    statusIdx: index('recipe_flags_status_idx').on(table.status),
    userIdIdx: index('recipe_flags_user_id_idx').on(table.user_id),
    createdAtIdx: index('recipe_flags_created_at_idx').on(table.created_at.desc()),
  })
);

// Slideshow photos table
export const slideshowPhotos = pgTable(
  'slideshow_photos',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    image_url: text('image_url').notNull(), // Vercel Blob URL
    caption: text('caption'),
    display_order: integer('display_order').notNull().default(0), // For manual ordering
    is_active: boolean('is_active').notNull().default(true), // Can hide without deleting
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    displayOrderIdx: index('slideshow_photos_display_order_idx').on(table.display_order),
    isActiveIdx: index('slideshow_photos_is_active_idx').on(table.is_active),
  })
);

// Hero Background Images table
export const heroBackgrounds = pgTable(
  'hero_backgrounds',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    image_url: text('image_url').notNull(), // Vercel Blob URL
    display_order: integer('display_order').notNull().default(0), // For sequencing
    is_active: boolean('is_active').notNull().default(true), // Can hide without deleting
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    displayOrderIdx: index('hero_backgrounds_display_order_idx').on(table.display_order),
    isActiveIdx: index('hero_backgrounds_is_active_idx').on(table.is_active),
  })
);

// ====================
// SOCIAL FEATURES (v0.6.0)
// ====================

// Recipe Likes table - thumbs-up/like system
export const recipeLikes = pgTable(
  'recipe_likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    user_id: text('user_id').notNull(), // Clerk user ID
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint: one like per user per recipe
    recipeUserUnique: unique().on(table.recipe_id, table.user_id),
    // Indexes for efficient queries
    recipeIdIdx: index('recipe_likes_recipe_id_idx').on(table.recipe_id),
    userIdIdx: index('recipe_likes_user_id_idx').on(table.user_id),
    createdAtIdx: index('recipe_likes_created_at_idx').on(table.created_at.desc()),
  })
);

// Recipe Forks table - recipe copying with attribution
export const recipeForks = pgTable(
  'recipe_forks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }), // The forked (new) recipe
    original_recipe_id: text('original_recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }), // The original recipe
    user_id: text('user_id').notNull(), // Clerk user ID who forked
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Indexes for efficient queries
    recipeIdIdx: index('recipe_forks_recipe_id_idx').on(table.recipe_id),
    originalRecipeIdIdx: index('recipe_forks_original_recipe_id_idx').on(table.original_recipe_id),
    userIdIdx: index('recipe_forks_user_id_idx').on(table.user_id),
    createdAtIdx: index('recipe_forks_created_at_idx').on(table.created_at.desc()),
  })
);

// Recipe Comments table - flat commenting with emoji support
export const recipeComments = pgTable(
  'recipe_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    user_id: text('user_id').notNull(), // Clerk user ID
    content: text('content').notNull(), // Comment text (supports emojis)
    is_edited: boolean('is_edited').notNull().default(false), // Track if edited
    is_flagged: boolean('is_flagged').notNull().default(false), // Moderation flag
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Indexes for efficient queries
    recipeIdIdx: index('recipe_comments_recipe_id_idx').on(table.recipe_id),
    userIdIdx: index('recipe_comments_user_id_idx').on(table.user_id),
    createdAtIdx: index('recipe_comments_created_at_idx').on(table.created_at.desc()),
    isFlaggedIdx: index('recipe_comments_is_flagged_idx').on(table.is_flagged),
  })
);

// ====================
// JOANIE'S PERSONAL NOTES (Joanie Comments)
// ====================

// Joanie Comments table - Personal observations and cooking stories from Joanie
export const joanieComments = pgTable(
  'joanie_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Flexible reference - comment can be attached to recipe, meal, or ingredient
    recipe_id: text('recipe_id').references(() => recipes.id, { onDelete: 'cascade' }),
    meal_id: uuid('meal_id'), // Will reference meals.id once imported
    ingredient_id: uuid('ingredient_id'), // Will reference ingredients.id once imported

    // Comment content
    comment_text: text('comment_text').notNull(),
    comment_type: text('comment_type', {
      enum: ['story', 'tip', 'substitution', 'general'],
    }),

    // Metadata
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    // Indexes for efficient queries
    recipeIdIdx: index('joanie_comments_recipe_id_idx').on(table.recipe_id),
    mealIdIdx: index('joanie_comments_meal_id_idx').on(table.meal_id),
    ingredientIdIdx: index('joanie_comments_ingredient_id_idx').on(table.ingredient_id),
    commentTypeIdx: index('joanie_comments_type_idx').on(table.comment_type),
    createdAtIdx: index('joanie_comments_created_at_idx').on(table.created_at.desc()),
  })
);

// ====================
// MEAL PLANNING INFRASTRUCTURE (v0.65.0)
// ====================

// NOTE: Ingredients and recipe_ingredients tables are defined in ingredients-schema.ts
// They are re-exported at the end of this file for convenience

// Kitchen Tools/Equipment table
export const tools = pgTable(
  'tools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(), // Canonical name (e.g., "large-pot")
    display_name: text('display_name').notNull(), // Display name (e.g., "Large Pot")
    category: text('category', {
      enum: [
        'cookware',
        'bakeware',
        'knives',
        'utensils',
        'appliances',
        'measuring',
        'prep',
        'serving',
        'other',
      ],
    }).notNull(),

    // Ontology categorization (NEW - 5 types, 48 subtypes)
    type: varchar('type', { length: 50 }), // CUTTING_PREP, COOKING_VESSELS, MIXING_MEASURING, HEAT_POWER, STORAGE_SERVING
    subtype: varchar('subtype', { length: 100 }), // knives_chef, pots_sauce, mixing_bowls, stovetop_gas, storage_containers, etc.

    // Tool characteristics
    is_essential: boolean('is_essential').default(false), // Part of basic kitchen
    is_specialized: boolean('is_specialized').default(false), // Specialized equipment
    alternatives: text('alternatives'), // JSON array of alternative tools

    // Metadata
    typical_price_usd: decimal('typical_price_usd', { precision: 8, scale: 2 }),
    description: text('description'),
    image_url: text('image_url'), // Tool image (/images/tools/...)

    // SEO slug for friendly URLs
    slug: varchar('slug', { length: 255 }).unique(), // SEO-friendly URL slug (e.g., "large-pot")

    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index('tools_name_idx').on(table.name),
    categoryIdx: index('tools_category_idx').on(table.category),
    isEssentialIdx: index('tools_is_essential_idx').on(table.is_essential),
    typeIdx: index('tools_type_idx').on(table.type),
    subtypeIdx: index('tools_subtype_idx').on(table.subtype),
    typeSubtypeIdx: index('tools_type_subtype_idx').on(table.type, table.subtype),
    slugIdx: index('tools_slug_idx').on(table.slug),
  })
);

// Recipe Tools mapping
export const recipeTools = pgTable(
  'recipe_tools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    tool_id: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),

    is_optional: boolean('is_optional').default(false),
    quantity: integer('quantity').default(1), // How many needed (e.g., 2 mixing bowls)
    notes: text('notes'), // Special notes (e.g., "8-inch or larger")

    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    recipeIdIdx: index('recipe_tools_recipe_id_idx').on(table.recipe_id),
    toolIdIdx: index('recipe_tools_tool_id_idx').on(table.tool_id),
  })
);

// Recipe Tasks - breaks down cooking into trackable tasks
export const recipeTasks = pgTable(
  'recipe_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipe_id: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),

    // Task description
    task_name: text('task_name').notNull(), // e.g., "Dice onions", "Boil pasta"
    task_order: integer('task_order').notNull(), // Sequence in recipe
    instruction_text: text('instruction_text').notNull(), // Full instruction

    // Task classification
    task_type: text('task_type', {
      enum: [
        'prep',
        'mixing',
        'cooking',
        'baking',
        'chilling',
        'resting',
        'boiling',
        'simmering',
        'sauteing',
        'searing',
        'roasting',
        'grilling',
        'frying',
        'assembly',
        'plating',
        'other',
      ],
    }).notNull(),

    // Restaurant-style role (for better task organization)
    role: text('role', {
      enum: [
        'prep_cook', // Chopping, peeling, measuring
        'line_cook', // Active cooking, sautéing, searing
        'pastry', // Baking, desserts
        'garde_manger', // Cold prep, salads, appetizers
        'sous_chef', // Coordination, multi-tasking
        'expeditor', // Final plating, assembly
      ],
    }).notNull(),

    // Time estimates (in minutes)
    active_time: integer('active_time').notNull(), // Hands-on time
    passive_time: integer('passive_time').default(0), // Waiting time (oven, chilling)

    // Dependencies and parallelization
    can_be_parallel: boolean('can_be_parallel').default(true), // Can be done alongside other tasks
    depends_on_task_ids: text('depends_on_task_ids'), // JSON array of task IDs that must be completed first

    // Tools and ingredients used in this specific task
    ingredient_ids: text('ingredient_ids'), // JSON array of ingredient IDs used
    tool_ids: text('tool_ids'), // JSON array of tool IDs used

    // Metadata
    parsed_by_model: text('parsed_by_model'), // LLM that generated this breakdown
    confidence_score: decimal('confidence_score', { precision: 3, scale: 2 }),

    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    recipeIdIdx: index('recipe_tasks_recipe_id_idx').on(table.recipe_id),
    taskOrderIdx: index('recipe_tasks_task_order_idx').on(table.recipe_id, table.task_order),
    taskTypeIdx: index('recipe_tasks_task_type_idx').on(table.task_type),
    roleIdx: index('recipe_tasks_role_idx').on(table.role),
  })
);

// NOTE: meals and mealRecipes tables are defined in meals-schema.ts
// They are re-exported at the end of this file for convenience

// Meal Occasions - predefined occasions/themes
export const mealOccasions = pgTable(
  'meal_occasions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    display_name: text('display_name').notNull(),
    description: text('description'),
    tags: text('tags'), // JSON array
    is_holiday: boolean('is_holiday').default(false),
    season: text('season', {
      enum: ['spring', 'summer', 'fall', 'winter', 'year-round'],
    }),
    icon: text('icon'), // Icon name for UI
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index('meal_occasions_name_idx').on(table.name),
    seasonIdx: index('meal_occasions_season_idx').on(table.season),
  })
);

// Type exports
export type RecipeLicense = (typeof recipeLicenseEnum.enumValues)[number];
export type RecipeSource = typeof recipeSources.$inferSelect;
export type NewRecipeSource = typeof recipeSources.$inferInsert;
export type RecipeSourceType = typeof recipeSourceTypes.$inferSelect;
export type NewRecipeSourceType = typeof recipeSourceTypes.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeEmbedding = typeof recipeEmbeddings.$inferSelect;
export type NewRecipeEmbedding = typeof recipeEmbeddings.$inferInsert;
export type RecipeRating = typeof recipeRatings.$inferSelect;
export type NewRecipeRating = typeof recipeRatings.$inferInsert;
export type RecipeFlag = typeof recipeFlags.$inferSelect;
export type NewRecipeFlag = typeof recipeFlags.$inferInsert;
export type SlideshowPhoto = typeof slideshowPhotos.$inferSelect;
export type NewSlideshowPhoto = typeof slideshowPhotos.$inferInsert;
export type HeroBackground = typeof heroBackgrounds.$inferSelect;
export type NewHeroBackground = typeof heroBackgrounds.$inferInsert;
export type RecipeLike = typeof recipeLikes.$inferSelect;
export type NewRecipeLike = typeof recipeLikes.$inferInsert;
export type RecipeFork = typeof recipeForks.$inferSelect;
export type NewRecipeFork = typeof recipeForks.$inferInsert;
export type RecipeComment = typeof recipeComments.$inferSelect;
export type NewRecipeComment = typeof recipeComments.$inferInsert;
export type JoanieComment = typeof joanieComments.$inferSelect;
export type NewJoanieComment = typeof joanieComments.$inferInsert;
export type JoanieCommentType = 'story' | 'tip' | 'substitution' | 'general';
// NOTE: Ingredient and RecipeIngredient types are re-exported from ingredients-schema.ts below
export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
export type RecipeTool = typeof recipeTools.$inferSelect;
export type NewRecipeTool = typeof recipeTools.$inferInsert;
export type RecipeTask = typeof recipeTasks.$inferSelect;
export type NewRecipeTask = typeof recipeTasks.$inferInsert;
// NOTE: Meal and MealRecipe types are re-exported from meals-schema.ts below
export type MealOccasion = typeof mealOccasions.$inferSelect;
export type NewMealOccasion = typeof mealOccasions.$inferInsert;

// Zod schemas for validation
export const insertRecipeSourceSchema = createInsertSchema(recipeSources);
export const selectRecipeSourceSchema = createSelectSchema(recipeSources);
export const insertRecipeSourceTypeSchema = createInsertSchema(recipeSourceTypes);
export const selectRecipeSourceTypeSchema = createSelectSchema(recipeSourceTypes);
export const insertRecipeSchema = createInsertSchema(recipes);
export const selectRecipeSchema = createSelectSchema(recipes);
export const insertRecipeEmbeddingSchema = createInsertSchema(recipeEmbeddings);
export const selectRecipeEmbeddingSchema = createSelectSchema(recipeEmbeddings);
export const insertRecipeRatingSchema = createInsertSchema(recipeRatings);
export const selectRecipeRatingSchema = createSelectSchema(recipeRatings);
export const insertRecipeFlagSchema = createInsertSchema(recipeFlags);
export const selectRecipeFlagSchema = createSelectSchema(recipeFlags);
export const insertSlideshowPhotoSchema = createInsertSchema(slideshowPhotos);
export const selectSlideshowPhotoSchema = createSelectSchema(slideshowPhotos);
export const insertHeroBackgroundSchema = createInsertSchema(heroBackgrounds);
export const selectHeroBackgroundSchema = createSelectSchema(heroBackgrounds);
export const insertJoanieCommentSchema = createInsertSchema(joanieComments);
export const selectJoanieCommentSchema = createSelectSchema(joanieComments);

// Re-export ingredient-related types and schemas for convenience
export {
  COMMON_UNITS,
  type GroupedRecipeIngredients,
  INGREDIENT_CATEGORIES,
  type Ingredient,
  type IngredientCategory,
  type IngredientStatistics,
  type IngredientWithStats,
  ingredientStatistics,
  ingredients,
  insertIngredientSchema,
  insertIngredientStatisticsSchema,
  insertRecipeIngredientSchema,
  type NewIngredient,
  type NewIngredientStatistics,
  type NewRecipeIngredient,
  PREPARATION_METHODS,
  type RecipeIngredient,
  type RecipeIngredientWithDetails,
  recipeIngredients,
  selectIngredientSchema,
  selectIngredientStatisticsSchema,
  selectRecipeIngredientSchema,
} from './ingredients-schema';
// Re-export inventory-related types and schemas for convenience
export {
  type InventoryItem,
  type InventoryItemWithDetails,
  type InventoryStats,
  type InventoryStatus,
  type InventoryUsageLog,
  insertInventoryItemSchema,
  insertInventoryUsageLogSchema,
  insertWasteTrackingSchema,
  inventoryItems,
  inventoryStatusEnum,
  inventoryUsageLog,
  type NewInventoryItem,
  type NewInventoryUsageLog,
  type NewWasteTracking,
  type StorageLocation,
  selectInventoryItemSchema,
  selectInventoryUsageLogSchema,
  selectWasteTrackingSchema,
  storageLocationEnum,
  type UsageAction,
  type UsageLogWithDetails,
  usageActionEnum,
  type WasteOutcome,
  type WasteStats,
  type WasteTracking,
  type WasteTrackingWithDetails,
  wasteOutcomeEnum,
  wasteTracking,
} from './inventory-schema';
// Re-export meals-related types and schemas for convenience
export {
  insertMealRecipeSchema,
  insertMealSchema,
  insertMealTemplateSchema,
  insertShoppingListSchema,
  type Meal,
  type MealRecipe,
  type MealTemplate,
  type MealWithRecipes,
  mealRecipes,
  meals,
  mealTemplates,
  type NewMeal,
  type NewMealRecipe,
  type NewMealTemplate,
  type NewShoppingList,
  type ShoppingList,
  type ShoppingListItem,
  type ShoppingListWithMeal,
  selectMealRecipeSchema,
  selectMealSchema,
  selectMealTemplateSchema,
  selectShoppingListSchema,
  shoppingLists,
} from './meals-schema';
