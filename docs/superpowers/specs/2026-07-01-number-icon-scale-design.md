# Number Icon Scale Display Design

## Context

Project properties already support number render modes for progress bars and stars. Stars are useful, but the same repeated-icon pattern can represent other rating-like number properties such as priority, risk, confidence, energy, or complexity. The new display options should stay local/offline, use Obsidian's built-in icon system, and avoid adding another icon setting.

## Decision

Use one unified icon-scale renderer for all repeated-icon number displays.

- Keep the existing `stars` render mode for backward compatibility.
- Add `pips` and `icons` as number render modes.
- Treat `stars` and `pips` as presets of the same icon scale behavior.
- Use Obsidian built-in icons through `setIcon`.
- Reuse the property's existing `icon` setting for the generic `icons` render mode.

Icon choice:

- `stars`: always uses the built-in `star` icon.
- `pips`: always uses the built-in `circle` icon.
- `icons`: uses the property's label icon when set, otherwise falls back to `circle`.

## User Experience

In **Settings → Project Notes → Properties**, number properties get these render choices: **Progress bar**, **Stars**, **Pips**, **Icons**, and **Text field**. The existing **Label icon** setting continues to control the summary label when **View label** is **Icon**, and it also becomes the glyph for the generic **Icons** number display.

Icon-scale displays are discrete integer scales. They show the same **Minimum** and **Maximum** settings that stars currently use. **Step** remains only for progress bars because progress uses a slider while repeated icons use direct integer choices.

Editing behavior:

- Each icon represents one integer value in the configured range.
- Filled icons indicate values less than or equal to the current value.
- Clicking an icon writes that integer value.
- The clear button removes the note property value.

Readonly and summary behavior:

- Pretty links, list rows, board cards, and other summary surfaces render filled and unfilled icons.
- Project note bars, editable table cells, list edit panels, and board edit panels render clickable icon buttons.
- The display includes an accessible text label with the formatted value.
- Empty values render as unset in dedicated readonly displays and are skipped in summaries that already hide empty properties.

## Architecture

Extend `ProjectPropertyRenderMode` with `pips` and `icons`. Update render-mode normalization so only number properties can select these modes. Existing saved `stars` properties remain valid and require no migration.

Refactor the current star-specific rendering in `src/ui/project-controls.ts` into shared icon-scale helpers:

- Resolve the glyph from the render mode and property definition.
- Generate integer scale values from the configured min/max.
- Render edit buttons for editable controls.
- Render filled/unfilled icons for readonly controls and summaries.

The existing CSS classes can be generalized from `spv-star-*` toward icon-scale classes while keeping compatibility where practical. The visual styling should stay close to the current stars treatment, with filled icons using `var(--interactive-accent)` and unfilled icons using muted text color.

## Data Flow

The source of truth remains the numeric frontmatter value. Reading, clamping, formatting, sorting, Bases column resolution, project metadata indexing, and project template generation do not need new storage behavior.

When a user edits an icon scale, `normalizePropertyInputValue` clamps the selected number to the property definition's min/max, then `updateProjectProperty` writes the scalar number into frontmatter.

## Error Handling

If the generic `icons` mode has no configured property icon, render `circle` instead of failing or showing a blank icon. Invalid saved render modes continue to normalize to the first compatible mode. Invalid numeric values continue to be treated as empty.

## Testing

Add focused tests for:

- `pips` and `icons` as compatible number render modes.
- normalization accepts valid new render modes and rejects them for non-number types.
- icon-scale glyph resolution uses `star`, `circle`, and the property icon fallback rules.
- table cells render all icon-scale modes through the shared editable icon-scale control.
- existing settings normalization keeps saved `stars` properties working.

Run `npm test` and `npm run build` after implementation.
