# BikriKoro Design-Only Audit — 27 August 2026

## Scope Guardrail

This audit is restricted to frontend presentation. No backend, database, request, route, permission, or business-logic behavior will be altered.

## Initial Findings

| Surface | Observation | Design-only opportunity |
|---|---|---|
| Shared customer header | The component already has a coherent neutral/green palette and responsive search pattern, but the desktop navigation, account menu, and control states use slightly different radius, shadow, and density treatments. | Normalize interactive controls around a compact surface hierarchy and clearer selected/hover states. |
| Public product catalogue | The catalogue provides a strong product grid and comprehensive filters, but the filter controls, category density, and count/action row compete for attention on smaller screens. | Improve grouping, spacing, and visual hierarchy without changing search, sorting, category, or product data behavior. |
| Mobile navigation | The current dock is a compact floating card with clear active hierarchy. It should be retained as the shared mobile navigation baseline while surrounding page bottom padding and fixed actions are checked. | Keep this as the interaction baseline and only tune page integration where overlap or spacing occurs. |
| Admin shell | The sidebar and workspace foundation are already structurally sound but use a much darker visual language and a denser control presentation than customer surfaces. | Apply an admin-specific, high-clarity surface system with more consistent panels, table density, status tones, and responsive header spacing. |

## Design Direction for This Pass

| Layer | Visual direction | In scope |
|---|---|---|
| Shared customer system | Keep the current white, soft-green, and warm-neutral marketplace palette. Restore intentional rounded controls, use a restrained surface shadow, and make emphasis come from contrast and spacing rather than extra decoration. | Global presentation rules, shared header and navigation controls, standard fields, buttons, and cards. |
| Browse and discovery | Give the search/filter bar a clearer home, reduce competing emphasis in the result meta row, and use better-separated product cards that retain delivery, trust, seller, and price hierarchy. | Catalogue controls, product cards, category/result framing, and related empty/loading surfaces. |
| Account and seller surfaces | Preserve the existing profile, verification, and operational content while applying the same card rhythm, status color meaning, and responsive spacing. | Shared component styling and existing visual utilities only; no profile, seller, or order data behavior changes. |
| Admin workspace | Use a deep forest operational sidebar with a calm white workspace, taller and more scannable stat cards, and cleaner table/filter panels. Apply green for trust/success, amber for items needing attention, red for sensitive actions, and blue only for neutral information. | Admin shell, shared admin page header/stat/table primitives, and existing page-level visual class treatments. |

> The implementation will not modify backend requests, Supabase/Firebase calls, data structures, routes, authentication, permissions, or commerce rules. It is a presentation-only pass.
