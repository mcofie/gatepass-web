-- Fix for foreign key constraint violation when deleting a discount that is referenced by a reservation
-- We change the constraint to ON DELETE SET NULL so deleting a discount doesn't error out, 
-- but just clears the discount link from the historical reservation record.

ALTER TABLE "gatepass"."reservations"
DROP CONSTRAINT "reservations_discount_id_fkey",
ADD CONSTRAINT "reservations_discount_id_fkey"
FOREIGN KEY ("discount_id") 
REFERENCES "gatepass"."discounts"("id") 
ON DELETE SET NULL;
