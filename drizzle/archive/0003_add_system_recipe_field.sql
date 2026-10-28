-- Add isSystemRecipe field to recipes table
ALTER TABLE "recipes" ADD COLUMN "is_system_recipe" boolean DEFAULT false;