-- Create event_staff table
create table gatepass.event_staff (
    id uuid default gen_random_uuid() primary key,
    event_id uuid references gatepass.events(id) on delete cascade not null,
    name text not null,
    email text not null,
    access_code text not null,
    role text default 'staff' not null,
    created_at timestamptz default now() not null,
    last_active_at timestamptz,
    
    -- Enforce unique code per event (or globally if easier, but per event is safer for collisions)
    -- Actually, simpler to make it unique per event.
    unique(event_id, access_code)
);

-- Index for fast lookup by code
create index event_staff_event_id_access_code_idx on gatepass.event_staff(event_id, access_code);

-- Add checked_in_by to tickets
alter table gatepass.tickets
add column checked_in_by uuid references gatepass.event_staff(id);

-- RLS Policies
alter table gatepass.event_staff enable row level security;

-- Event Organizers can view/manage their staff
create policy "Organizers can manage staff for their events"
    on gatepass.event_staff
    for all
    using (
        exists (
            select 1 from gatepass.events
            where events.id = event_staff.event_id
            and events.organizer_id = auth.uid()
        )
    );

-- Public/Staff can select via code (handled via secure RPC or service role usually, but for direct lookup):
-- We might need a "verify_staff_code" RPC function to keep the table secure from public enumeration.
-- For now, let's allow service role full access.
