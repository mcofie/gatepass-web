-- Events get a portrait video for phones alongside the existing one, which becomes the landscape (desktop) video.
ALTER TABLE gatepass.events ADD COLUMN IF NOT EXISTS video_url_portrait text;

COMMENT ON COLUMN gatepass.events.video_url IS 'Landscape background video, shown on desktop';
COMMENT ON COLUMN gatepass.events.video_url_portrait IS 'Portrait background video, shown on phones';
