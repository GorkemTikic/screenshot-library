# FD Screenshot Library — Agent Send Mode and Quick Markup

Date: 2026-09-13
Status: Approved product direction, awaiting written-spec review

## Goal

Make the Library's promise — “Find the Shot, Copy It, Paste It on the Chat” — literal. Agents must be able to copy the screenshot itself directly from a catalog card, optionally annotate it in the inspector, and preserve the existing EN/TR response-copy workflow.

The feature must remain fast and local-first: markup is temporary, no edited image is uploaded, and no catalog record changes.

## Evidence and product rationale

The live aggregate data showed 12,441 interactions from 70 tracked devices. Owner-level usage contained 2,780 screenshot views and 1,058 response-text copies. Multiple guides have repeated views but no response copy, while historical requests repeatedly mention users struggling to follow text-only directions or needing a precise screen in another language or platform.

The current card's primary copy action copies response text, despite the product message implying screenshot copying. Agent Send Mode closes that gap without introducing an external chat integration or an AI workflow.

## Scope

### Included

- Add `Copy Screenshot` beside the existing response-copy action on every screenshot card.
- Preserve the existing EN/TR selector and `Copy EN` / `Copy TR` response behavior.
- Add the same two copy actions to the inspector.
- Add a lightweight, canvas-based Quick Markup editor inside the inspector.
- Support crop, arrow, numbered marker, highlight, blur, undo, redo, and reset.
- Copy original or edited images at source resolution.
- Track screenshot-copy outcomes and privacy-safe markup usage.
- Separate screenshot copies from response copies in owner analytics.
- Support pointer, touch, and essential keyboard operation.

### Explicitly excluded

- Download fallback.
- Direct posting into a chat product.
- Claims that content was pasted or sent; the browser cannot verify that outcome.
- Send trays, multi-screenshot packs, or clipboard history.
- Permanent annotations or replacement of catalog assets.
- Uploading rendered images, annotation coordinates, or pixel data.
- Automatic language/platform variant grouping.
- AI-generated annotations or replies.

## Card interaction design

Each screenshot card keeps the current metadata, owner identity, EN/TR selector, inspector entry, and favorite behavior.

The action area contains two adjacent actions:

1. `Copy Screenshot` — the visually primary action. It copies the unedited catalog image.
2. `Copy EN` or `Copy TR` — the existing response-copy action. Its label follows the selected response language.

Behavior for `Copy Screenshot`:

- While preparing the image, the control enters a busy state and cannot be triggered twice.
- On success, it briefly becomes `Screenshot copied` with a check icon and displays the concise instruction `Paste it on chat`.
- On failure, it enters an explicit error state and shows a short explanation such as `Browser blocked image copying. Allow clipboard access and try again.`
- It never silently downloads or navigates away.
- Repeated successful copies are valid, independently tracked actions.

Behavior for response copy is unchanged except for layout adjustments required to fit both actions. EN/TR continues to switch only the response text; it does not alter the catalog image.

## Inspector and Quick Markup interaction design

Opening a screenshot continues to launch the fitted, full-image inspector. The media side gains a compact `Quick Markup` toolbar that does not compete with the primary copy actions.

### Default inspector state

- The full screenshot is visible using the existing contain/fit behavior.
- `Copy Screenshot` copies the original asset.
- `Copy EN` / `Copy TR` copies the selected response.
- Markup controls are visible but no tool is selected.

### Markup mode

Selecting a drawing tool starts an ephemeral editing session. The image remains visually fitted, while pointer coordinates are transformed into source-image coordinates.

Tools:

- `Crop` — draw and adjust one rectangular output boundary. A later crop replaces the prior crop boundary.
- `Arrow` — drag from tail to head; use one high-contrast editorial accent style.
- `Number` — click/tap to place sequential circular markers beginning at 1. Removing or undoing a marker restores a coherent sequence for subsequent placements.
- `Highlight` — drag a translucent, high-contrast rectangular emphasis area.
- `Blur` — brush or drag a rectangular region whose pixels are blurred in the rendered output.
- `Undo` — revert the latest crop or annotation operation.
- `Redo` — restore the latest undone operation until a new operation branches the history.
- `Reset` — clear the crop and every annotation after a confirmation only when work exists.

The editor uses one restrained default visual style rather than exposing color, stroke-width, font, and opacity pickers. This keeps the workflow quick and prevents an unnecessary design-tool surface.

### Copying edited output

As soon as at least one crop or annotation operation exists, the inspector's `Copy Screenshot` action copies a freshly rendered edited image and indicates that markup will be included. Resetting all operations returns the action to original-image copying.

Closing the inspector discards the entire markup session. Navigating to the previous or next screenshot also starts a clean session for the destination image; annotations never leak across records.

## Clipboard pipeline

A single image-copy service owns browser clipboard behavior.

### Original image

1. Resolve the catalog image URL with the existing image resolver.
2. Fetch and decode the source asset.
3. Draw it to a source-dimension canvas.
4. Encode the canvas as PNG because browser image clipboard writing is most reliable with PNG payloads.
5. Write the PNG `Blob` through `ClipboardItem` and `navigator.clipboard.write` during the user-initiated action.

### Edited image

1. Render the decoded source at its intrinsic dimensions.
2. Apply the selected crop boundary as the output coordinate space.
3. Render highlights and blurred regions below arrows and numbered markers.
4. Scale display-space stroke widths and marker sizes back to source-space values so the exported result matches the preview.
5. Encode and write the final PNG using the same clipboard service.

The application must not replace the browser-native image clipboard with a text URL. A URL in the clipboard is not a successful screenshot copy.

## Editor state model

Quick Markup stores serializable vector operations rather than mutating the source bitmap.

Conceptual state:

```text
MarkupSession
  recordId
  sourceWidth
  sourceHeight
  crop: rectangle | null
  operations: ordered annotation operations
  historyIndex
  activeTool
```

Each operation has a generated local ID, a tool type, and normalized source coordinates. Blur regions store geometry only while the session is alive. The renderer creates the actual blurred pixels only during preview/export.

State transitions live in a pure reducer so tool behavior, undo/redo branching, reset, crop replacement, and numbered-marker sequencing can be tested without a browser canvas.

## Component boundaries

### `ScreenshotCard`

- Presents the two copy actions.
- Delegates image copying to the clipboard service.
- Owns only card-level pending/success/error presentation.
- Continues delegating response copy to the existing text-copy utility.

### `Lightbox`

- Preserves navigation, focus, response language, and response copy.
- Hosts the markup editor and inspector-level copy state.
- Resets the session when the active record changes or the inspector closes.

### `QuickMarkupEditor`

- Displays the fitted source image and annotation overlay.
- Translates pointer/touch/display coordinates to normalized source coordinates.
- Emits reducer actions; it does not write to the clipboard or analytics directly.

### Markup reducer and renderer

- The reducer owns deterministic editing history.
- The renderer accepts a decoded image plus a `MarkupSession` and returns a PNG-ready canvas/blob.
- Both can be tested independently from React.

### Clipboard service

- Keeps the current plain-text copy function intact.
- Adds capability detection, image decoding, PNG conversion, and image clipboard writing.
- Returns a typed result that distinguishes success, permission denial, unsupported API, image decoding failure, and clipboard write failure.

### Analytics event builders

- Extend the existing screenshot event metadata.
- Never receive image blobs, pixels, annotation coordinates, or response contents.

## Analytics contract

### Events

`copy_text` remains unchanged and continues to contain record, owner, language, platform, source, response language, and clipboard method.

`copy_image` is emitted once for every completed attempt with:

- existing screenshot identity metadata;
- `source`: `card` or `inspector`;
- `method`: `clipboard` or `failed`;
- `success`: `true` only after the browser confirms the clipboard write, otherwise `false`;
- `edited`: `true` or `false`;
- `toolsUsed`: a comma-separated, deduplicated list such as `crop,arrow,blur`, or an empty value;
- `failureReason`: a bounded category such as `permission`, `unsupported`, `decode`, or `write`, only on failure.

`markup_opened` is emitted once when a previously clean inspector session receives its first editing operation. Tool pointer movements do not emit events. This avoids event spam and keeps totals meaningful.

### Sheet/API dimensions

The Apps Script log schema gains bounded columns for `Edited`, `Tools_Used`, `Success`, and `Failure_Reason`. New fields are additive and preserve the order and meaning of existing columns.

### Owner analytics

Owner aggregates preserve existing response-copy totals for backward compatibility and add:

- `imageCopies` — successful `copy_image` events only;
- `editedImageCopies` — successful `copy_image` events with `edited=true`;
- `responseCopies` — successful legacy `copy_text` events;
- per-record equivalents in owner details.

Failed copy attempts remain available for reliability analysis but do not credit an owner as a successful use. Owner attribution continues to resolve against the ownership interval active at event time.

## Error and concurrency behavior

- Each copy control has an independent pending state; copying text does not block image copying.
- A pending image-copy action ignores duplicate activation until it settles.
- Clipboard errors never close the inspector or destroy markup.
- A failed edited-image copy can be retried without rerendering annotations from scratch.
- If the source asset cannot be decoded, markup tools remain unavailable and the inspector explains that the image cannot currently be prepared.
- Navigating during an unfinished render invalidates the old result so it cannot be copied or reported against the new record.
- Analytics transmission remains fire-and-forget and never changes the visible result of a successful clipboard operation.

## Accessibility and responsive behavior

- Every tool and copy control has an explicit accessible name and visible focus state.
- Tool selection exposes pressed/selected state to assistive technology.
- Undo uses `Ctrl/Cmd+Z`; redo uses `Ctrl/Cmd+Shift+Z` while markup mode is focused.
- Escape first cancels an in-progress gesture; a subsequent Escape follows the inspector's existing close behavior.
- Pointer events provide a common mouse, pen, and touch path.
- The toolbar can horizontally scroll on narrow displays without reducing the image to an unusable size.
- On compact screens, copy actions stack while `Copy Screenshot` remains first and visually primary.
- Status and error feedback is announced through a polite live region and is not communicated by color alone.

## Testing strategy

### Unit tests

- Image clipboard capability detection and typed errors.
- JPEG/WebP source conversion to PNG clipboard payload.
- Reducer operations for every tool.
- Undo, redo, branching after undo, and reset.
- Crop replacement and coordinate clamping.
- Number sequencing after undo/reset.
- Analytics payload privacy and success/failure classification.
- Owner aggregation separates screenshot and response copies and respects ownership history.

### Component tests

- Card exposes both `Copy Screenshot` and selected-language response copy.
- EN/TR selection changes only response copy.
- Successful and failed screenshot-copy states render correctly.
- Inspector enters markup mode, retains operations after a failed copy, and resets on close/navigation.
- Copying a clean session uses the original path; copying a dirty session uses the markup renderer.

### Browser tests

- Production-equivalent secure context can copy a catalog image as an image clipboard item.
- Card copy produces the original dimensions.
- Crop and annotations produce expected exported dimensions and visible output.
- Mouse and touch/pointer gestures work.
- Focus, Escape, undo, and redo behavior works.
- Existing gallery search, filtering, favorites, inspector navigation, and response copy remain functional.

Canvas output is verified using stable fixture images and pixel-tolerant assertions rather than brittle whole-file byte comparisons.

## Acceptance criteria

1. Every catalog card shows `Copy Screenshot` and the existing `Copy EN` / `Copy TR` response action.
2. Card screenshot copy writes image data, not a URL or filename, to the clipboard.
3. The inspector offers crop, arrow, number, highlight, blur, undo, redo, and reset.
4. Edited output is copied at the crop's source-resolution dimensions, or full source dimensions when uncropped.
5. Closing or navigating the inspector clears temporary markup and never mutates catalog data.
6. No download occurs on success or failure.
7. Users receive explicit success, pending, and actionable failure states.
8. Analytics distinguishes response copies, original screenshot copies, edited screenshot copies, and failed attempts without collecting annotation contents.
9. Owner analytics counts only successful copies and preserves historical ownership rules.
10. Automated tests cover clipboard behavior, editor history, render/export, analytics, and regressions in existing card/inspector behavior.

## Delivery sequence

Implementation planning should divide the work into independently verifiable slices:

1. Image clipboard service and analytics contract.
2. Card and inspector screenshot-copy controls.
3. Pure markup state/reducer and rendering pipeline.
4. Inspector toolbar and pointer/touch interaction.
5. Owner analytics extensions.
6. Accessibility, responsive polish, regression testing, and production-like browser verification.

No deployment or push is implied by this design document. Those actions require the implementation to pass review and verification and must follow the user's deployment direction at that time.
