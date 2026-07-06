# Select and Multi-Select Property Design

## Context

Project Notes custom properties currently support scalar text, number, date, and date/time values with several render modes. Users need two new property styles:

- **Select**, backed by Obsidian's Text property storage.
- **Multi-select**, backed by Obsidian's List property storage.

Both property styles should let users configure allowed options in settings. Option colors are enabled per property, generated automatically for new options, and editable afterwards. Existing note values that are not configured options must be preserved and shown rather than dropped.

## Decision

Extend the existing custom property model instead of adding a parallel option system.

- Add `select` and `multiselect` render modes.
- Keep Select compatible with the existing `text` value type.
- Add a `list` value type for Multi-Select so it maps directly to Obsidian list frontmatter.
- Add per-property option metadata:
  - `options`: ordered list of option definitions.
  - `optionsColored`: boolean toggle for colored option rendering.
- Store each option with a stable `id`, displayed `value`, and editable `color`.
- Generate deterministic colors for new or repaired options, then persist the color so users can change it.

This keeps custom properties as the source of truth and avoids creating reusable global option sets before there is a clear need for them.

## User Experience

In **Settings → Project Notes → Properties**, expanded custom properties keep the existing settings for label, note property name, value type, render mode, view label, and label icon.

Value type choices become **Text**, **Number**, **Date**, **Date/time**, and **List**. Render choices are constrained by type:

- Text: **Text**, **Text area**, **Select**.
- List: **Multi-select**.
- Number: **Progress bar**, **Stars**, **Pips**, **Icons**, **Text**.
- Date: **Date**, **Text**.
- Date/time: **Date/time**, **Text**.

When a property renders as Select or Multi-Select, settings also show:

- **Color options** toggle for that property.
- One row per option with option text, color picker, move up/down controls, and delete.
- **Add option** control.

New options receive generated colors. Users can edit each color through the settings row. If coloring is off for the property, the saved colors remain available but are not used in project views.

## Editing Behavior

Select properties render as a dropdown wherever custom properties are editable: create-project modal, note toolbar, list edit panel, board edit panel, and table edit surfaces. The dropdown includes **Unset**, configured options, and the current value if it is not in the configured options.

Multi-Select properties render as a compact group of toggleable option controls. Configured options appear in settings order. Current unknown/freeform note values appear selected alongside them so the user can see and preserve existing data.

Editing rules:

- Select writes one scalar text value or removes the property when unset.
- Multi-Select writes an ordered YAML list or removes the property when the selected list is empty.
- Toggling configured Multi-Select options preserves current unknown values.
- Unknown values can be cleared by clearing the field or removing that selected unknown value in the control.
- Duplicate and blank list values are normalized away for display and subsequent writes.

## Readonly Display

Readonly summaries, board/list cards, table readonly displays, relationship details, and pretty links use the same option formatting helpers.

When `optionsColored` is enabled, Select and Multi-Select values render as compact chips using the saved option color. Unknown values render as chips with a neutral fallback color. When coloring is disabled, values render as plain text; Multi-Select values are joined with commas.

Empty Select and Multi-Select properties follow existing custom-property behavior: they are skipped in summaries that hide empty fields and displayed as unset in dedicated readonly controls.

## Architecture

Extend `ProjectPropertyDefinition` with option metadata:

```ts
interface ProjectPropertyOptionDefinition {
	id: string;
	value: string;
	color: string;
}

interface ProjectPropertyDefinition {
	options: ProjectPropertyOptionDefinition[];
	optionsColored: boolean;
}
```

Extend `ProjectPropertyValue` so list-backed properties can retain their structured values:

```ts
interface ProjectPropertyValue {
	value: string;
	values: string[];
}
```

For scalar properties, `values` contains either zero or one value. For list properties, `values` contains the normalized ordered list. Existing scalar rendering can continue using `value`.

Update property helpers in `src/project-properties.ts` to:

- Normalize `list` as a valid value type.
- Normalize `select` and `multiselect` render modes only for compatible types.
- Normalize option definitions by trimming values, removing blank and duplicate values, assigning stable IDs, and repairing invalid colors.
- Generate option colors from a deterministic palette or hash so recreated options are stable.
- Resolve display metadata for configured and unknown option values.
- Treat list properties as empty when their normalized value list is empty.
- Normalize property input values to `string[]` for list-backed properties.

Update frontmatter/template writers so `ProjectPropertyInputValue` supports `string[]`:

- `updatePropertyInMarkdown` writes arrays as block YAML lists.
- Empty arrays remove the property.
- `buildProjectContent` writes list-backed project creation values as YAML lists.
- Existing scalar write behavior remains unchanged.

## Data Flow

Reading project metadata:

1. Obsidian frontmatter values are read by `ProjectIndex`.
2. `readProjectPropertyValue` normalizes scalar values or list values according to the property definition.
3. Project views receive both the joined display string and structured `values`.

Editing project metadata:

1. UI controls produce `string`, `string[]`, `number`, or `null`.
2. `normalizePropertyInputValue` validates the value against the property definition.
3. `updateProjectProperty` writes the scalar or list value into frontmatter.
4. Existing refresh paths update toolbars, views, and pretty links.

Settings changes:

1. Expanded property settings mutate option metadata on the property definition.
2. `saveSettings` runs normalization before persisting.
3. Project surfaces refresh with updated option labels and colors.

## Error Handling

Saved settings remain backward compatible:

- Missing `options` becomes an empty list.
- Missing `optionsColored` becomes `false`.
- Invalid option rows are removed if they have no value.
- Duplicate option values keep the first occurrence.
- Invalid colors are replaced with generated colors.
- Invalid saved render modes normalize to the first compatible render mode.

If a Select or Multi-Select property has no configured options, existing values still display and can be cleared. The controls do not fail or erase unknown values.

## Testing

Add focused tests for:

- Compatible render modes for text/list/select/multiselect.
- Settings normalization for option metadata, duplicate options, invalid colors, and default `optionsColored`.
- Reading scalar Select values and list Multi-Select values, including unknown values.
- Empty detection for list-backed properties.
- Input normalization for Select and Multi-Select values.
- YAML writer behavior for arrays: create, replace scalar with list, replace list, and remove empty list.
- Project template frontmatter output for list-backed values.
- Option color generation and fallback behavior.

Run `npm test` and `npm run build` after implementation.
