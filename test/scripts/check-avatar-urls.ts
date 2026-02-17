import { db } from "@/lib/db/index";
import { chefs } from "@/lib/db/chef-schema";
import { sql } from "drizzle-orm";

async function checkAvatarUrls() {
  try {
    const chefRecords = await db
      .select({
        slug: chefs.slug,
        name: chefs.name,
        profileImageUrl: chefs.profile_image_url,
      })
      .from(chefs)
      .orderBy(chefs.slug);

    console.log("Chef Avatar URLs in Database:");
    console.log("=".repeat(80));
    for (const chef of chefRecords) {
      console.log(`${chef.slug.padEnd(25)} | ${chef.profileImageUrl || "(null)"}`);
    }
    console.log("=".repeat(80));
    console.log(`Total chefs: ${chefRecords.length}`);
  } catch (error) {
    console.error("Error checking avatar URLs:", error);
    process.exit(1);
  }
  process.exit(0);
}

checkAvatarUrls();
