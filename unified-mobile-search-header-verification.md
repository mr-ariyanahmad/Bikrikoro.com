# Unified Mobile Search Header Verification

## 2026-08-27

The shared layout now renders the compact home-style primary search field in its top mobile header for every route except `/search`, which retains its dedicated full-screen search field. The former non-home secondary row containing a back control and duplicate search field has been removed.

Desktop breakpoints retain the existing back control and standard desktop search. Build, lint, and the deployed chat-route response check passed. The live browser verification session became unavailable after the deployment response check, so no further browser interactions were attempted.
