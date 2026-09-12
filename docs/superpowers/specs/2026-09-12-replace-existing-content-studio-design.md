# Replace Existing Screenshot — Content Studio Design

## Goal

Make the difference between creating a new catalog entry and updating an existing screenshot unmistakable. A contributor must be able to find a currently published screenshot, select it, compare its current image with a new upload, edit its copy, and publish the replacement without discovering a hidden card action first.

## Root cause

`ContentList` currently exposes one dominant action, `New screenshot`. That action opens `ContentEditor` with `item=null`. The editor then displays an empty `Current` image frame even though no existing record can be selected from that modal. Existing records can only be opened from individual content cards, where the strongest `Edit & replace` affordance is hover-dependent.

The backend replacement path is already correct. The defect is the missing selection step and misleading create-state presentation in Content Studio.

## Chosen interaction model

Content Studio will expose two explicit peer actions:

- `Replace existing` opens a dedicated searchable selector.
- `Create new` opens a clean creation editor.

The selector will search across title, owner, topic, language, and platform. Each result will show the current thumbnail and the same identifying metadata so the contributor can verify the record before continuing.

Selecting a result opens the existing `ContentEditor` with that complete catalog record. The editor will display `Current` and `Replacement` previews side by side, prefill all text and classification fields, retain the version used for conflict detection, and continue using the existing ownership-transfer rule.

## Recovery from the wrong entry point

The create editor will include a visible banner:

> Updating something already published? Choose an existing screenshot first so its history and ownership stay connected.

`Choose existing` closes the empty create editor and opens the selector. If the contributor already typed or uploaded something, the existing unsaved-change confirmation protects that draft.

## Create-state cleanup

When no current catalog record exists:

- The image area shows one full-width `New image` preview, not an empty `Current` frame.
- Helper copy describes creating a guide instead of replacing one.
- The primary action says `Publish new screenshot`.
- The page and toolbar use `Create new`, keeping the concept distinct from replacement.

## Existing-state cleanup

When a current record is selected:

- The heading says `Replace image or edit guide`.
- The current record ID and owner remain visible.
- The uploader says `Choose replacement image`.
- The primary action says `Publish changes`.
- Card actions are visible without hover and use the label `Replace / edit`.

## Additional consistency fixes

- The content count says `published guides` in normal mode and `archived guides` in archive mode.
- An empty result message refers to the active published/archive view.
- The selector contains only currently published records; archived recovery remains in `Show archived`.
- Search and result count use shared pure filtering logic so the list and selector cannot disagree.

## Data and publishing rules

No API or database changes are required.

- A selected record keeps its `id`, `version`, `ownerKey`, and history in `baseRecord`.
- Text-only edits preserve ownership.
- Uploading a different image transfers ownership to the authenticated contributor after successful atomic publication.
- Concurrent edits continue through the existing combined text/image conflict resolver.
- Creating a new guide remains impossible without an uploaded image.

## Accessibility and responsive behavior

- The selector is an accessible modal with a labelled search field and close button.
- Every result is a real button with a descriptive accessible label.
- Escape closes the selector through the existing modal interaction pattern.
- Mobile layouts use a single-column result list and never rely on hover to expose replacement actions.
- Focus moves to the selector search field on open.

## Verification

Automated coverage will prove:

- shared filtering matches title, owner, topic, language, and platform;
- archived items never appear in the replacement selector;
- count labels distinguish published and archived modes;
- Content Studio wires both create and replace entry points;
- create mode does not render an empty `Current` preview;
- the escape route from create mode to selection is present.

Browser verification will cover desktop and mobile flows from Content Studio through selection, file preview, and the enabled publish state without submitting a destructive catalog mutation.
