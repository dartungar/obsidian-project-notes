# Project Relationships Design

## Summary

Add parent and child relationships between project notes. The relationship source of truth is always the current project note's own properties: the note bar reads the current note's configured parent property and configured children property, and it does not infer relationships by scanning other notes.

## Goals

- Support one parent and many children for each project note.
- Store relationships in project note properties as Obsidian links to other notes.
- Make the parent and children property names configurable in a new **Relationships** settings tab.
- Show existing relationships on the project note bar.
- Provide a note bar button and command to create a child project from the active project note.
- When creating a child, write the parent link to the child note and append the child link to the parent note's children list.

## Non-Goals

- Do not infer a parent's children from other notes' parent properties.
- Do not scan the whole vault to reconcile relationships.
- Do not introduce network calls or external services.
- Do not change project matching behavior.

## Data Model

Add relationship settings:

- `relationshipPropertyNames.parent`, default `parent`
- `relationshipPropertyNames.children`, default `children`

The parent value is stored as a single Obsidian link string:

```yaml
parent: "[[Projects/Main project]]"
```

The children value is stored as a YAML list of Obsidian link strings:

```yaml
children:
  - "[[Projects/Child A]]"
  - "[[Projects/Child B]]"
```

Relationship links should use Obsidian's markdown link format and should be resolved with the metadata cache where possible for display and navigation. Existing scalar or list values should be read defensively. Empty, missing, or unresolvable values are skipped in the note bar rather than shown as broken UI.

## Source of Truth

For a given current project note:

- Its parent is exactly what its own configured parent property says.
- Its children are exactly what its own configured children property says.
- Other notes' properties are not used to add, remove, or override relationships for this note.

The create-child workflow may update both files as a convenience, but later display still follows the current note only.

## Settings UI

Add a **Relationships** tab to the existing settings tabs.

The tab contains:

- Parent property name text field.
- Children property name text field.

Both fields trim whitespace and fall back to defaults during settings normalization if absent or empty.

## Note Bar UI

The project note bar continues to render existing project controls. It also renders a relationship section when relationships or child creation are available.

Behavior:

- Show a parent row only when the current note has a parent link.
- Show a children list only when the current note has one or more child links.
- Child links are displayed as a vertical list.
- Each relationship item opens the target note when selected.
- Show a create-child button on project notes when relationship property names are configured.
- The UI uses Obsidian-style buttons, icons, and compact note bar styling.

## Create Child Workflow

Add a command with a stable ID such as `create-child-project`.

Availability:

- Command is available only when the active markdown file is a project.
- Note bar button is shown only for project notes.

Flow:

1. User runs the command or selects the note bar button.
2. A child creation modal opens using the existing project creation flow.
3. After the child note is created:
   - Set the child's configured parent property to a link to the parent note.
   - Append a link to the child note to the parent's configured children property.
   - Avoid duplicate child links if the parent already lists that child.
   - Refresh project surfaces.
4. If creating or updating either note fails, show a short failure notice and log the error.

The existing create-project behavior remains unchanged for ordinary project creation.

## Frontmatter Editing

Extend frontmatter helpers to support list properties in addition to existing scalar property updates.

Required helper behavior:

- Set scalar parent link values.
- Append child link values to a YAML list.
- Create frontmatter if missing.
- Replace a scalar children value with a list containing the old value and new value.
- Preserve existing children list entries.
- De-duplicate children by normalized link text.
- Delete behavior for existing scalar properties remains unchanged.
- Existing duplicate YAML repair behavior remains unchanged.

## Testing

Add tests before implementation for:

- Normalizing relationship settings with defaults.
- Reading parent and children values from frontmatter into relationship link values.
- Updating a scalar parent link.
- Appending a child link to a missing children property.
- Appending a child link to an existing children list.
- Avoiding duplicate child links.
- Replacing an existing scalar children value with a YAML list.

Run the full existing test suite after implementation:

```bash
npm test
```

Run the production build after tests:

```bash
npm run build
```

## Open Decisions

All design decisions needed for implementation are settled:

- The current note's own relationship properties are the source of truth.
- Relationship links are stored as Obsidian links.
- Property names are configurable on a dedicated **Relationships** settings tab.
- Create-child updates both the parent and child notes as a convenience.
