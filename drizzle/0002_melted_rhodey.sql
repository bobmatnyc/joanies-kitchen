CREATE TABLE "usage_counters" (
	"bucket" text NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_counters_bucket_key_window_unique" UNIQUE("bucket","key","window_start")
);
--> statement-breakpoint
CREATE INDEX "idx_usage_counters_window_start" ON "usage_counters" USING btree ("window_start");