ALTER TYPE "public"."recurring_kind" ADD VALUE 'transfer';--> statement-breakpoint
ALTER TABLE "recurring_items" ADD COLUMN "target_account_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_target_account_id_accounts_id_fk" FOREIGN KEY ("target_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_items_target_account_idx" ON "recurring_items" USING btree ("target_account_id");