ALTER TABLE "meals" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
CREATE INDEX "meals_slug_idx" ON "meals" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_slug_unique" UNIQUE("slug");