alter table "gatepass"."reservations" add column "discount_id" uuid references "gatepass"."discounts"("id");
