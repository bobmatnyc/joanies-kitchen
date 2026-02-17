import Firecrawl from '@mendable/firecrawl-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const apiKey = process.env.FIRECRAWL_API_KEY;

async function testFirecrawl() {
  console.log('🔍 Testing Firecrawl scrape of Barefoot Contessa recipe...');
  console.log('API Key present:', Boolean(apiKey));

  if (!apiKey) {
    console.error('❌ FIRECRAWL_API_KEY not found in environment');
    process.exit(1);
  }

  const firecrawl = new Firecrawl({ apiKey });
  const url = 'https://barefootcontessa.com/recipes/ultimate-beef-stew';

  try {
    console.log('\n⏳ Scraping:', url);
    const result = await firecrawl.scrape(url, {
      formats: ['markdown', 'html']
    });

    console.log('\n✅ Scrape successful!');
    console.log('\nMarkdown length:', result.markdown?.length || 0);
    console.log('\nFirst 1000 chars of markdown:');
    console.log(result.markdown?.substring(0, 1000));
    console.log('\n...');
    console.log('\nLast 500 chars of markdown:');
    console.log(result.markdown?.substring((result.markdown?.length || 0) - 500));
  } catch (error: any) {
    console.error('\n❌ Scrape failed:', error.message);
    console.error('Error details:', error);
  }
}

testFirecrawl();
