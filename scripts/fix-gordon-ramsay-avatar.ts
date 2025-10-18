import { db } from "../src/lib/db/index";
import { chefs } from "../src/lib/db/chef-schema";
import { eq } from "drizzle-orm";

async function fixGordonRamsayAvatar() {
  try {
    console.log("Updating Gordon Ramsay avatar to use local image...");

    const result = await db
      .update(chefs)
      .set({
        profile_image_url: "/chefs/avatars/gordon-ramsay.jpg",
        updated_at: new Date(),
      })
      .where(eq(chefs.slug, "gordon-ramsay"))
      .returning();

    if (result.length > 0) {
      console.log("✅ Successfully updated Gordon Ramsay avatar:");
      console.log(`   Old URL: https://images.unsplash.com/...`);
      console.log(`   New URL: ${result[0].profile_image_url}`);
    } else {
      console.log("⚠️  No chef found with slug 'gordon-ramsay'");
    }
  } catch (error) {
    console.error("❌ Error updating avatar:", error);
    process.exit(1);
  }
  process.exit(0);
}

fixGordonRamsayAvatar();
