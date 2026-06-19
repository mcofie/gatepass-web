-- Create event_form_questions table
CREATE TABLE IF NOT EXISTS gatepass.event_form_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES gatepass.events(id) ON DELETE CASCADE NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'select', 'checkbox')),
    options TEXT[], -- NULL or empty array if type is text or checkbox
    required BOOLEAN DEFAULT false NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create event_form_responses table
CREATE TABLE IF NOT EXISTS gatepass.event_form_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id UUID REFERENCES gatepass.reservations(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES gatepass.event_form_questions(id) ON DELETE CASCADE NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure only one response per question per reservation
    UNIQUE(reservation_id, question_id)
);

-- Enable RLS
ALTER TABLE gatepass.event_form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gatepass.event_form_responses ENABLE ROW LEVEL SECURITY;

-- event_form_questions policies
DROP POLICY IF EXISTS "Allow public select" ON gatepass.event_form_questions;
CREATE POLICY "Allow public select" ON gatepass.event_form_questions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow event owners to manage questions" ON gatepass.event_form_questions;
CREATE POLICY "Allow event owners to manage questions" ON gatepass.event_form_questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM gatepass.events
            WHERE id = event_id
            AND (organizer_id = auth.uid() OR organization_id IN (
                SELECT id FROM gatepass.organizers WHERE user_id = auth.uid()
            ))
        )
    );

-- event_form_responses policies
DROP POLICY IF EXISTS "Allow public select" ON gatepass.event_form_responses;
CREATE POLICY "Allow public select" ON gatepass.event_form_responses
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert" ON gatepass.event_form_responses;
CREATE POLICY "Allow public insert" ON gatepass.event_form_responses
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow organizers to update responses" ON gatepass.event_form_responses;
CREATE POLICY "Allow organizers to update responses" ON gatepass.event_form_responses
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM gatepass.event_form_questions q
            JOIN gatepass.events e ON e.id = q.event_id
            WHERE q.id = question_id
            AND (e.organizer_id = auth.uid() OR e.organization_id IN (
                SELECT id FROM gatepass.organizers WHERE user_id = auth.uid()
            ))
        )
    );

DROP POLICY IF EXISTS "Allow organizers to delete responses" ON gatepass.event_form_responses;
CREATE POLICY "Allow organizers to delete responses" ON gatepass.event_form_responses
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM gatepass.event_form_questions q
            JOIN gatepass.events e ON e.id = q.event_id
            WHERE q.id = question_id
            AND (e.organizer_id = auth.uid() OR e.organization_id IN (
                SELECT id FROM gatepass.organizers WHERE user_id = auth.uid()
            ))
        )
    );
