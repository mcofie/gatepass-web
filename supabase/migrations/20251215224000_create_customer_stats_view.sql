create or replace view "gatepass"."customer_stats" as
select
  coalesce(p.email, r.guest_email) as email,
  -- Take the 'maximum' (alphabetically last) name/phone to behave as 'any'
  -- This ensures we group purely by unique email
  max(coalesce(p.full_name, r.guest_name, 'Unknown')) as name,
  max(coalesce(p.phone_number, r.guest_phone)) as phone,
  count(t.id) as tickets_bought,
  sum(t.amount) as total_spent,
  max(t.paid_at) as last_seen
from "gatepass"."transactions" t
join "gatepass"."reservations" r on t.reservation_id = r.id
left join "gatepass"."profiles" p on r.user_id = p.id
where t.status = 'success'
  -- Ensure we don't return rows without emails (though unlikely if model enforced)
  and coalesce(p.email, r.guest_email) is not null
group by
  coalesce(p.email, r.guest_email);
