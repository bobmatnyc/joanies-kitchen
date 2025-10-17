import matter from 'gray-matter';

export interface ParsedRecipe {
  title: string;
  description?: string;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  servings?: number;
  difficulty?: string;
  cuisine?: string;
  imageUrl?: string;
  ingredients: string[];
  instructions: string[];
  tags?: string[];
  nutritionInfo?: Record<string, any>;
}

/**
 * Parse markdown content into a recipe object
 */
export function parseMarkdownRecipe(markdownContent: string): ParsedRecipe {
  const { data: frontmatter, content } = matter(markdownContent);

  const recipe: ParsedRecipe = {
    title: frontmatter.title || 'Untitled Recipe',
    description: frontmatter.description,
    prepTime: frontmatter.prepTime,
    cookTime: frontmatter.cookTime,
    totalTime: frontmatter.totalTime,
    servings: frontmatter.servings,
    difficulty: frontmatter.difficulty,
    cuisine: frontmatter.cuisine,
    imageUrl: frontmatter.imageUrl,
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
    nutritionInfo: frontmatter.nutritionInfo || {},
    ingredients: [],
    instructions: [],
  };

  // Parse content for ingredients and instructions
  const lines = content.split('\n');
  let currentSection = '';
  let _instructionNumber = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for section headers
    if (trimmedLine.match(/^#{1,2}\s+(Ingredients?)/i)) {
      currentSection = 'ingredients';
      continue;
    }
    if (trimmedLine.match(/^#{1,2}\s+(Instructions?|Directions?|Steps?)/i)) {
      currentSection = 'instructions';
      _instructionNumber = 0;
      continue;
    }
    if (trimmedLine.match(/^#{1,2}\s/)) {
      // Any other header resets the section
      currentSection = '';
      continue;
    }

    // Parse ingredients (bullet points)
    if (currentSection === 'ingredients' && trimmedLine.startsWith('- ')) {
      recipe.ingredients.push(trimmedLine.substring(2).trim());
    }

    // Parse instructions (numbered list or bullet points)
    if (currentSection === 'instructions') {
      // Handle numbered lists (1. , 2. , etc.)
      const numberedMatch = trimmedLine.match(/^\d+\.\s+(.+)/);
      if (numberedMatch) {
        recipe.instructions.push(numberedMatch[1].trim());
      }
      // Handle bullet points in instructions
      else if (trimmedLine.startsWith('- ')) {
        recipe.instructions.push(trimmedLine.substring(2).trim());
      }
      // Handle continuation of previous instruction (non-empty lines without markers)
      else if (trimmedLine && recipe.instructions.length > 0) {
        // Append to the last instruction
        recipe.instructions[recipe.instructions.length - 1] += ` ${trimmedLine}`;
      }
    }
  }

  return recipe;
}
