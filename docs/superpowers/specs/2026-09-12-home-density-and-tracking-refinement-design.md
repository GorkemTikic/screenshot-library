# FD Screenshot Library — Home Density and Tracking Refinement

Date: 2026-09-12
Status: Approved direction, documented for implementation

## Objective

Make the Library home page faster to scan, more recognizably part of the FD product family, and more analytically useful without recording noisy raw DOM clicks.

## Hero

- Remove the `FD knowledge workspace` eyebrow entirely.
- Replace the current headline with a three-beat product instruction:
  - `Find the Shot`
  - `Copy It`
  - `Paste It in Chat.`
- Render the beats as one accessible heading with visually distinct segments and directional arrows.
- Keep motion restrained: the segments may enter in sequence, but must respect `prefers-reduced-motion`.
- Shorten the supporting paragraph to one line on wide screens and no more than two compact lines on mobile.

## Library pulse

- Replace the two large summary cards with one compact horizontal pulse row.
- Show three useful facts: visible guide count, language count, and latest catalog update.
- The pulse row must collapse cleanly on mobile without horizontal page overflow.
- Values remain derived from the live catalog; no duplicated hard-coded totals.

## Owner identity

- Every owner receives a deterministic visual identity used consistently on cards, the inspector, Content Studio, and owner analytics.
- Approved named palette:
  - `CS Gorkem T`: orange
  - `CS Enzo`: blue
  - `CS VERA`: violet
- Future contributor names use deterministic generated hues, so the same person always receives the same color.
- Color is supplementary; initials and full owner names remain visible for accessibility.

## Card density

- Reduce minimum card width and internal spacing by roughly 12–15 percent.
- Keep screenshot aspect ratio and image legibility.
- Present topic, language/platform, title, owner, freshness, EN/TR switch, copy, and inspect actions in a tighter information hierarchy.
- Preserve touch targets at a minimum of 36 CSS pixels and keep card actions keyboard accessible.

## Analytics events

Record meaningful product interactions rather than every raw click. All events retain stable device identifiers and include relevant catalog/filter metadata.

Events:

- `search_commit`: debounced non-empty query with result count; never fire per keystroke.
- `filter_platform`, `filter_topic`, `filter_language`, `filter_favorites`: selected value and result count.
- `view_image`: screenshot title/topic/owner and entry point.
- `inspector_navigate`: direction and destination screenshot metadata.
- `copy_text`: screenshot metadata, selected response language, and source (`card` or `inspector`).
- `switch_lang`: destination response language and source.
- `favorite_add` and `favorite_remove`: screenshot metadata.
- `right_click_image`: screenshot metadata.

Request submissions and Survey submissions retain their existing dedicated events. Analytics failures remain non-blocking and never interrupt the support workflow.

## Verification

- Domain tests cover owner color mapping and event payload construction.
- Component source/runtime contracts cover the approved headline and compact pulse.
- Browser QA covers desktop and 390px mobile layouts, overflow, owner color distinction, copy/inspect actions, and console errors.
- Existing frontend tests, lint, production build, Worker tests, Worker typecheck, and Worker dry-run must remain green.
