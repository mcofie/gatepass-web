-- Fixed platform fee prices per currency. price_minor/currency stay as the base (GHS) price;
-- prices holds clean local price points, e.g. {"USD": 2000, "NGN": 3500000} (minor units).
ALTER TABLE gatepass.platform_pricing_tiers
    ADD COLUMN IF NOT EXISTS prices jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed starting price points for the paid tiers (edit in /admin/settings)
UPDATE gatepass.platform_pricing_tiers t
SET prices = seed.prices
FROM (VALUES
    ('Standard',   '{"USD": 1900,  "EUR": 1800,  "GBP": 1500,  "NGN": 3000000,  "KES": 250000,  "ZAR": 35000}'::jsonb),
    ('Growth',     '{"USD": 5900,  "EUR": 5500,  "GBP": 4900,  "NGN": 9000000,  "KES": 750000,  "ZAR": 99000}'::jsonb),
    ('Large',      '{"USD": 14900, "EUR": 13900, "GBP": 11900, "NGN": 24000000, "KES": 1950000, "ZAR": 269000}'::jsonb),
    ('Enterprise', '{"USD": 34900, "EUR": 32900, "GBP": 27900, "NGN": 58000000, "KES": 4500000, "ZAR": 649000}'::jsonb)
) AS seed(name, prices)
WHERE t.name = seed.name AND t.prices = '{}'::jsonb;
