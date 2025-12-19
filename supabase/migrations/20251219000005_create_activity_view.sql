create or replace view gatepass.admin_activity_feed as
with
sales as (
  select
    t.id::text,
    'sale' as type,
    t.created_at as timestamp,
    jsonb_build_object(
      'amount', t.amount,
      'currency', t.currency,
      'buyer', coalesce(p.full_name, r.guest_name, 'Guest'),
      'event_title', e.title
    ) as data
  from gatepass.transactions t
  left join gatepass.reservations r on t.reservation_id = r.id
  left join gatepass.profiles p on r.user_id = p.id
  left join gatepass.events e on r.event_id = e.id
  where t.status = 'success'
),
users as (
  select
    id::text,
    'user' as type,
    created_at as timestamp,
    jsonb_build_object(
      'email', email,
      'name', full_name
    ) as data
  from gatepass.profiles
),
events as (
  select
    e.id::text,
    'event' as type,
    e.created_at as timestamp,
    jsonb_build_object(
      'title', e.title,
      'venue', e.venue_name,
      'organizer', o.name
    ) as data
  from gatepass.events e
  left join gatepass.organizers o on e.organization_id = o.id
),
logs as (
  select
    l.id::text,
    'admin_log' as type,
    l.created_at as timestamp,
    jsonb_build_object(
      'action', l.action,
      'target_type', l.target_type,
      'metadata', l.metadata,
      'actor_email', p.email,
      'actor_name', p.full_name
    ) as data
  from gatepass.activity_logs l
  left join gatepass.profiles p on l.actor_id = p.id
)
select * from sales
union all
select * from users
union all
select * from events
union all
select * from logs;
