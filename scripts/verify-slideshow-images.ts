import 'dotenv/config';
import { list } from '@vercel/blob';

async function verifyImages() {
  console.log('Checking slideshow images in Vercel Blob...\n');

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Error: BLOB_READ_WRITE_TOKEN not found');
    process.exit(1);
  }

  try {
    const blobs = await list({ prefix: 'slideshow/' });

    console.log(`Found ${blobs.blobs.length} slideshow images:\n`);

    blobs.blobs.forEach((blob, idx) => {
      const sizeKB = blob.size / 1024;
      console.log(`[${idx + 1}] ${blob.pathname}`);
      console.log(`    URL: ${blob.url}`);
      console.log(`    Size: ${sizeKB.toFixed(2)} KB`);
      console.log(`    Uploaded: ${blob.uploadedAt}\n`);
    });

    console.log('Images are accessible!\n');
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verifyImages();
