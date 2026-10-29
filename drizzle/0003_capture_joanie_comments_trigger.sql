-- D14: capture the joanie_comments updated_at trigger that prod has but no
-- migration created. Copied from prod via pg_get_functiondef/pg_get_triggerdef.
-- No-op on prod: the function body is identical, and the trigger is created
-- only when it does not exist.
CREATE OR REPLACE FUNCTION public.update_joanie_comments_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $function$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'joanie_comments_updated_at_trigger'
      AND tgrelid = 'public.joanie_comments'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER joanie_comments_updated_at_trigger
      BEFORE UPDATE ON public.joanie_comments
      FOR EACH ROW EXECUTE FUNCTION public.update_joanie_comments_updated_at();
  END IF;
END
$$;
