'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq, and, inArray, or } from 'drizzle-orm';
import { recipeToMarkdown, generateRecipeFilename } from '@/lib/utils/markdown-formatter';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

/**
 * Export a single recipe as markdown
 */
export async function exportRecipeAsMarkdown(recipeId: string) {
  const { userId } = await auth();

  // Fetch the recipe - allow public recipes or user's own recipes
  const recipe = await db.query.recipes.findFirst({
    where: userId
      ? or(
          and(eq(recipes.id, recipeId), eq(recipes.user_id, userId)),
          and(eq(recipes.id, recipeId), eq(recipes.is_public, true))
        )
      : and(eq(recipes.id, recipeId), eq(recipes.is_public, true)),
  });

  if (!recipe) {
    throw new Error('Recipe not found or access denied');
  }

  // Convert to markdown
  const markdown = recipeToMarkdown(recipe);
  const filename = generateRecipeFilename(recipe.name);

  return {
    content: markdown,
    filename,
    mimeType: 'text/markdown',
  };
}

/**
 * Export multiple recipes as a zip file
 */
export async function exportRecipesAsZip(recipeIds: string[]) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  if (!recipeIds || recipeIds.length === 0) {
    throw new Error('No recipes selected');
  }

  // Fetch all selected recipes
  const selectedRecipes = await db.query.recipes.findMany({
    where: and(
      inArray(recipes.id, recipeIds),
      eq(recipes.user_id, userId)
    ),
  });

  if (selectedRecipes.length === 0) {
    throw new Error('No recipes found');
  }

  // Create zip file
  const zip = new JSZip();

  selectedRecipes.forEach((recipe) => {
    const markdown = recipeToMarkdown(recipe);
    const filename = generateRecipeFilename(recipe.name);
    zip.file(filename, markdown);
  });

  // Generate zip as base64
  const zipContent = await zip.generateAsync({ type: 'base64' });

  return {
    content: zipContent,
    filename: `recipes-export-${new Date().toISOString().split('T')[0]}.zip`,
    mimeType: 'application/zip',
  };
}

/**
 * Export all user recipes as a zip file
 */
export async function exportAllRecipesAsZip() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  // Fetch all user recipes
  const userRecipes = await db.query.recipes.findMany({
    where: eq(recipes.user_id, userId),
  });

  if (userRecipes.length === 0) {
    throw new Error('No recipes found');
  }

  // Create zip file
  const zip = new JSZip();

  userRecipes.forEach((recipe) => {
    const markdown = recipeToMarkdown(recipe);
    const filename = generateRecipeFilename(recipe.name);
    zip.file(filename, markdown);
  });

  // Generate zip as base64
  const zipContent = await zip.generateAsync({ type: 'base64' });

  return {
    content: zipContent,
    filename: `all-recipes-export-${new Date().toISOString().split('T')[0]}.zip`,
    mimeType: 'application/zip',
    count: userRecipes.length,
  };
}

/**
 * Export a single recipe as PDF
 */
export async function exportRecipeAsPDF(recipeId: string) {
  const { userId } = await auth();

  // Fetch the recipe - allow public recipes or user's own recipes
  const recipe = await db.query.recipes.findFirst({
    where: userId
      ? or(
          and(eq(recipes.id, recipeId), eq(recipes.user_id, userId)),
          and(eq(recipes.id, recipeId), eq(recipes.is_public, true))
        )
      : and(eq(recipes.id, recipeId), eq(recipes.is_public, true)),
  });

  if (!recipe) {
    throw new Error('Recipe not found or access denied');
  }

  // Parse JSON fields
  const ingredients = typeof recipe.ingredients === 'string'
    ? JSON.parse(recipe.ingredients)
    : recipe.ingredients || [];
  const instructions = typeof recipe.instructions === 'string'
    ? JSON.parse(recipe.instructions)
    : recipe.instructions || [];
  const tags = recipe.tags
    ? (typeof recipe.tags === 'string' ? JSON.parse(recipe.tags) : recipe.tags)
    : [];
  const nutritionInfo = recipe.nutrition_info
    ? (typeof recipe.nutrition_info === 'string' ? JSON.parse(recipe.nutrition_info) : recipe.nutrition_info)
    : null;

  // Create PDF document
  const doc = new jsPDF();
  let yPosition = 20;
  const lineHeight = 7;
  const pageHeight = 280;
  const margin = 20;

  // Helper function to add text with page breaks
  const addTextWithPageBreak = (text: string, fontSize: number = 12, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    const font = isBold ? 'bold' : 'normal';
    doc.setFont('helvetica', font);

    const lines = doc.splitTextToSize(text, 170);

    for (const line of lines) {
      if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, margin, yPosition);
      yPosition += lineHeight;
    }
  };

  // Add title
  addTextWithPageBreak(recipe.name, 20, true);
  yPosition += 5;

  // Add description
  if (recipe.description) {
    addTextWithPageBreak(recipe.description, 12, false);
    yPosition += 5;
  }

  // Add metadata
  const metadata: string[] = [];
  if (recipe.prep_time) metadata.push(`Prep Time: ${recipe.prep_time} minutes`);
  if (recipe.cook_time) metadata.push(`Cook Time: ${recipe.cook_time} minutes`);
  if (recipe.servings) metadata.push(`Servings: ${recipe.servings}`);
  if (recipe.difficulty) metadata.push(`Difficulty: ${recipe.difficulty}`);
  if (recipe.cuisine) metadata.push(`Cuisine: ${recipe.cuisine}`);

  if (metadata.length > 0) {
    addTextWithPageBreak(metadata.join(' | '), 10, false);
    yPosition += 10;
  }

  // Add ingredients
  addTextWithPageBreak('INGREDIENTS', 14, true);
  yPosition += 3;

  ingredients.forEach((ingredient: string) => {
    addTextWithPageBreak(`• ${ingredient}`, 11, false);
  });
  yPosition += 5;

  // Add instructions
  addTextWithPageBreak('INSTRUCTIONS', 14, true);
  yPosition += 3;

  instructions.forEach((instruction: string, index: number) => {
    addTextWithPageBreak(`${index + 1}. ${instruction}`, 11, false);
  });

  // Add nutrition info if available
  if (nutritionInfo && Object.keys(nutritionInfo).length > 0) {
    yPosition += 5;
    addTextWithPageBreak('NUTRITION INFORMATION', 14, true);
    yPosition += 3;

    Object.entries(nutritionInfo).forEach(([key, value]) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      addTextWithPageBreak(`${label}: ${value}`, 11, false);
    });
  }

  // Add tags if available
  if (tags && tags.length > 0) {
    yPosition += 5;
    addTextWithPageBreak('TAGS', 14, true);
    yPosition += 3;
    addTextWithPageBreak(tags.join(', '), 11, false);
  }

  // Generate PDF as base64
  const pdfContent = doc.output('datauristring').split(',')[1];
  const filename = recipe.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.pdf';

  return {
    content: pdfContent,
    filename,
    mimeType: 'application/pdf',
  };
}