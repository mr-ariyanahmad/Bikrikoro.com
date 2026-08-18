-- BikriKoro — allow content managers to use the admin notification campaign console.
-- Migration 028 protects campaign RPCs with content.notifications. The original
-- CONTENT_MANAGER seed did not include that permission, so campaign creation
-- failed with a database authorization error for that role.

update public.admin_roles
set permissions = case
  when permissions ? 'content.notifications' then permissions
  else permissions || '["content.notifications"]'::jsonb
end,
updated_at = now()
where role_key = 'CONTENT_MANAGER';
