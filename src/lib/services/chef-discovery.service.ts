/**
 * Chef Discovery Service
 *
 * Auto-creates or retrieves chef profiles from the database given a name and website.
 * When creating a new chef:
 *   1. Scrapes the chef's "About" page with Jina Reader
 *   2. Summarises the bio with Claude Haiku (if ANTHROPIC_API_KEY is set)
 *   3. Inserts the chef record and returns the chef.id
 */

import Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

export interface ChefProfile {
  id: string;
  name: string;
  slug: string;
  website?: string | null;
  bio?: string | null;
  isNew: boolean;
}

export class ChefDiscoveryService {
  private _anthropic: Anthropic | null = null;

  private readonly jinaApiKey: string;
  private readonly anthropicApiKey: string;

  constructor() {
    this.jinaApiKey = process.env.JINA_API_KEY || '';
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
  }

  private get anthropic(): Anthropic {
    if (!this._anthropic) {
      if (!this.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
      this._anthropic = new Anthropic({ apiKey: this.anthropicApiKey });
    }
    return this._anthropic;
  }

  /**
   * Find an existing chef by name, or create a new one.
   *
   * @param chefName - Human-readable name (e.g. "Ella Mills")
   * @param website  - Optional website URL to scrape for bio generation
   * @returns ChefProfile with id and isNew flag
   */
  async findOrCreateChef(chefName: string, website?: string): Promise<ChefProfile> {
    const slug = this.nameToSlug(chefName);

    // Check if chef exists
    const [existing] = await db
      .select()
      .from(chefs)
      .where(eq(chefs.slug, slug))
      .limit(1);

    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        slug: existing.slug,
        website: existing.website,
        bio: existing.bio,
        isNew: false,
      };
    }

    // Generate bio if website provided
    let bio: string | undefined;
    if (website) {
      bio = await this.generateBio(chefName, website);
    }

    // Create new chef record
    const [newChef] = await db
      .insert(chefs)
      .values({
        slug,
        name: chefName,
        website: website ?? null,
        bio: bio ?? null,
        is_active: true,
        is_verified: false,
        recipe_count: 0,
      })
      .returning();

    console.log(`[ChefDiscovery] Created new chef: "${chefName}" (${slug})`);

    return {
      id: newChef.id,
      name: newChef.name,
      slug: newChef.slug,
      website: newChef.website,
      bio: newChef.bio,
      isNew: true,
    };
  }

  /**
   * Convert a human name to a URL-friendly slug
   * "Ella Mills" → "ella-mills"
   */
  private nameToSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Spaces → hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .trim();
  }

  /**
   * Try to generate a chef bio by:
   *   1. Fetching the website's About page with Jina Reader
   *   2. Summarising with Claude Haiku
   */
  private async generateBio(chefName: string, website: string): Promise<string | undefined> {
    const aboutUrl = this.buildAboutUrl(website);
    console.log(`[ChefDiscovery] Fetching bio for "${chefName}" from: ${aboutUrl}`);

    let pageContent: string | null = null;

    if (this.jinaApiKey) {
      try {
        pageContent = await this.fetchWithJina(aboutUrl);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[ChefDiscovery] Jina fetch failed for bio: ${msg}`);
      }
    }

    if (!pageContent || pageContent.length < 100) return undefined;

    if (this.anthropicApiKey) {
      try {
        return await this.summariseBio(chefName, pageContent);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[ChefDiscovery] Claude bio summarisation failed: ${msg}`);
      }
    }

    // If no Claude, return a truncated excerpt of the scraped content
    return pageContent.substring(0, 500).trim();
  }

  /**
   * Build an "About" page URL from a website root
   */
  private buildAboutUrl(website: string): string {
    try {
      const base = website.replace(/\/$/, ''); // Remove trailing slash
      return `${base}/about`;
    } catch {
      return website;
    }
  }

  /**
   * Fetch a URL's content using Jina Reader
   */
  private async fetchWithJina(url: string): Promise<string | null> {
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.jinaApiKey}`,
        Accept: 'text/plain',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`Jina Reader error ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    return text.length > 50 ? text.substring(0, 4000) : null;
  }

  /**
   * Use Claude Haiku to summarise a chef bio from page content
   */
  private async summariseBio(chefName: string, pageContent: string): Promise<string> {
    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Based on the following web page content, write a 2-3 sentence professional bio for ${chefName}. Focus on their culinary background, specialties, and approach to cooking. Return ONLY the bio text, no other commentary.

Page content:
${pageContent.substring(0, 3000)}`,
        },
      ],
    });

    const bio =
      message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';

    return bio || `${chefName} is a chef and recipe developer.`;
  }
}

// Singleton
let _instance: ChefDiscoveryService | null = null;

export function getChefDiscoveryService(): ChefDiscoveryService {
  if (!_instance) {
    _instance = new ChefDiscoveryService();
  }
  return _instance;
}
