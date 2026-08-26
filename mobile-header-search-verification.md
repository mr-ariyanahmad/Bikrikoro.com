# Mobile Header Search Verification

## 2026-08-26

The homepage route now renders its compact `SearchBar` inside the top mobile header, between the logo and the right-side controls. The former standalone search row is suppressed only on the homepage; non-home mobile routes retain the existing back button and search row.

The desktop live homepage was checked after deployment and continues to show the existing full search field, location picker, account control, and desktop navigation. Build and lint completed successfully, with the existing Fast Refresh warning in `AuthContext.tsx` as the only lint warning.
