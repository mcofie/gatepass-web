-- Create Organizers table
CREATE TABLE IF NOT EXISTS gatepass.organizers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL, -- The owner of the organization
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    description TEXT,
    website TEXT,
    twitter TEXT,
    instagram TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Organizers
ALTER TABLE gatepass.organizers ENABLE ROW LEVEL SECURITY;

-- Allow users to view all organizers (public profiles) - or maybe just valid ones? Let's say public for now.
CREATE POLICY "Public organizers are viewable by everyone" ON gatepass.organizers
    FOR SELECT USING (true);

-- Allow users to insert their own organizations
CREATE POLICY "Users can create organizations" ON gatepass.organizers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own organizations
CREATE POLICY "Users can update own organizations" ON gatepass.organizers
    FOR UPDATE USING (auth.uid() = user_id);

-- Link Events to Organizers
-- We add a new column 'organization_id' to events. 
-- Existing 'organizer_id' was referring to the creator user. We keep it as 'created_by' effectively.
ALTER TABLE gatepass.events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES gatepass.organizers(id);
