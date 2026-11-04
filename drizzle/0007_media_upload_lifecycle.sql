CREATE TABLE "media_uploads" (
	"key" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attached_at" timestamp with time zone,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_uploads_state_valid" CHECK ("media_uploads"."state" in ('pending', 'attached', 'deleting', 'deleted'))
);
--> statement-breakpoint
CREATE INDEX "idx_media_uploads_cleanup" ON "media_uploads" USING btree ("attempted_at","created_at","key") WHERE "media_uploads"."state" in ('pending', 'deleting');
--> statement-breakpoint
CREATE FUNCTION "guard_media_upload_attachment"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state = 'attached' AND OLD.state IN ('deleting', 'deleted') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'media_uploads_attach_available',
      MESSAGE = 'That uploaded image has expired; please insert it again.';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "media_uploads_attach_available"
BEFORE UPDATE OF "state" ON "media_uploads"
FOR EACH ROW EXECUTE FUNCTION "guard_media_upload_attachment"();
