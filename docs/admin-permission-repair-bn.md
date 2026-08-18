# Admin Permission Repair

## Why SQL succeeded but admin pages failed

The project supports two admin paths: the legacy `admin_emails` Super Admin allowlist and the role-based `admin_members` table. The previous `admin_access()` function used `UNION ALL ... LIMIT 1` without making the Super Admin allowlist take priority. If the same Firebase user existed in both places, PostgreSQL could return a restricted role such as an operations or content manager. The frontend could open some admin routes, but RPCs for deliveries, finance, reviews, orders, blog, or FAQ would reject the operation.

## Repair migration

Run only this new migration after 036:

```text
037_super_admin_priority.sql
```

It makes an email present in `admin_emails` deterministically resolve to:

```text
SUPER_ADMIN → ["*"]
```

It does not remove or change restricted sub-admin roles. Non-Super Admin members continue to receive only their assigned permissions.

## Verify the active admin identity

After running 037, use the Supabase SQL Editor with the Firebase UID of the account currently logged into the website:

```sql
select * from public.admin_access('PASTE_FIREBASE_UID_HERE');
```

The primary admin account should return:

```text
is_admin = true
role_key = SUPER_ADMIN
permissions = ["*"]
```

The Firebase UID can be copied from the user profile or from the browser application’s Firebase user details. Do not paste an API key or password into SQL Editor.

If the account is not in the legacy allowlist, add only the exact Gmail used for the Firebase login:

```sql
insert into public.admin_emails(email)
values (lower('YOUR_ADMIN_GMAIL@gmail.com'))
on conflict (email) do nothing;
```

Then sign out and sign in again so the website receives a fresh auth session.

## Test pages

After migration 037 succeeds and the user signs in again, test:

```text
/admin/orders
/admin/deliveries
/admin/finance
/admin/reviews
/admin/blog
/admin/faq
/admin/coupons
```

A page with no records should say that no records exist. It should not show a migration error. If a non-Super Admin account opens a restricted page, it should remain blocked by design.
