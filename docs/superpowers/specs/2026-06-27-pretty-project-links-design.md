# Pretty Project Links Design

## Summary

Add configurable pretty rendering for links that point to project notes. Pretty project links appear in both Reading view and Live Preview, show the configured project properties, and provide a project-aware right-click menu while preserving normal link navigation.

## Goals

- Add a **Pretty links** settings tab.
- Let users enable or disable pretty project links.
- Let users choose which project fields appear on pretty links.
- Render links to project notes as compact project link cards in Reading view.
- Render links to project notes as compact project link cards in Live Preview.
- Preserve ordinary Obsidian link behavior for navigation, modifier clicks, unresolved links, and links to non-project notes.
- Add a right-click project context menu with status and property actions.
- Include a **Note actions** item that exposes Obsidian's standard note context actions for the linked note.

## Non-Goals

- Do not render pretty links in Source mode.
- Do not change the markdown stored in notes.
- Do not scan the entire vault during rendering.
- Do not add network calls or telemetry.
- Do not change project matching rules.
- Do not replace Obsidian's normal context menu for non-project links.

## Settings

Add these settings:

- `prettyLinksEnabled`, default `true`.
- `prettyLinkFields`, default `["status"]`.

The **Pretty links** tab contains:

- An enable toggle.
- A field list with toggles for `status` and every configured project property with a non-empty note property name.

The field order follows the existing project property order. `status` is first. Normalization removes unknown, duplicate, or empty values and allows an empty list when the user wants title-only pretty links.

## Rendering Architecture

Use one shared renderer and two mode-specific adapters.

- Shared renderer: resolves a link to a project, builds the pretty link DOM, renders selected read-only fields, handles click navigation, and attaches the right-click menu.
- Reading view adapter: uses `registerMarkdownPostProcessor` to find rendered internal links and replace only links that resolve to project notes.
- Live Preview adapter: uses Obsidian's editor extension support to decorate internal link tokens that resolve to project notes.

The shared renderer should reuse existing project display code where possible:

- Use `ProjectIndex` to verify that the linked file is a project.
- Use `renderProjectControls(..., {readOnly: true})` for selected non-empty summary fields.
- Use the existing status display settings and project property definitions.

Rendering is best-effort. If the target file cannot be resolved, the target is not a project, the link includes a block/heading subpath that cannot safely be represented, or rendering throws, keep the normal link.

## Reading View Behavior

For each rendered internal link:

1. Read the original link target from Obsidian's link attributes.
2. Resolve the target with `metadataCache.getFirstLinkpathDest`.
3. If the file is a project and pretty links are enabled, replace the link element with a pretty link element.
4. Keep the displayed title based on the alias text when present, otherwise the project title.
5. Open the linked file on normal click.

The postprocessor should avoid reprocessing links already handled by this plugin.

## Live Preview Behavior

Live Preview should decorate rendered internal links, not Source mode plain text. The decoration should show the same compact pretty link surface as Reading view and keep editor interaction predictable.

Behavior:

- Only decorate resolvable project links.
- Recompute decorations when editor content, metadata, settings, or project frontmatter changes.
- Avoid decorating while a link token is actively being edited if doing so would interfere with text editing.
- Keep keyboard and mouse navigation consistent with Obsidian's normal Live Preview links.

If Obsidian's editor API cannot expose enough stable link information for one-to-one parity, the fallback is to decorate only the stable rendered Live Preview link DOM and leave active editing spans untouched.

## Pretty Link UI

A pretty project link is compact enough to sit inline with text but can wrap when it contains multiple fields.

It contains:

- Project icon when configured and present.
- Link label, using the link alias when present and the project title otherwise.
- Selected fields from **Pretty links** settings, skipping empty project properties.

It uses existing Obsidian theme variables and existing summary/status styles where possible. It should not use large card styling, heavy shadows, or marketing-like visuals.

## Context Menu

Right-clicking a pretty project link opens a project menu.

Menu contents:

- Open note.
- Status submenu or status items for configured statuses.
- Property actions for configured project properties shown in the menu.
- **Note actions** item containing Obsidian's standard note context menu items for the linked file.

The project actions update the linked project note's frontmatter through existing update helpers and then refresh all project surfaces. Failures show a short notice and log the error.

The **Note actions** item should reuse Obsidian's file menu APIs if available. If the API does not support injecting the standard note menu as a submenu, use the closest native behavior available, such as opening the standard file context menu from that menu item.

## Data Flow

1. Settings are loaded and normalized.
2. Link adapters detect an internal link and resolve it relative to the source note.
3. `ProjectIndex.getProject` reads cached metadata for the target file.
4. The shared renderer builds the pretty link from the target project and selected fields.
5. User clicks open the target note through the workspace.
6. User right-clicks run project property updates or delegated note actions.
7. Metadata changes trigger `refreshProjectSurfaces`, which refreshes note bars, Bases views, and pretty link adapters.

## Error Handling

- Leave normal links untouched when resolution fails.
- Skip fields that no longer exist in settings.
- Skip empty fields in rendered links.
- Show a notice if a menu property update fails.
- Log unexpected render or update errors with a `Simple project views` prefix.

## Testing

Add focused tests for:

- Normalizing pretty link settings.
- Removing duplicate and unknown pretty link fields.
- Allowing title-only pretty links with an empty field list.
- Selecting visible fields from project settings and a project.
- Resolving only project-note links into pretty link render data.

Run verification:

```bash
npm test
npm run build
```

## Open Decisions

All user-facing design decisions are settled:

- Pretty links apply in both Reading view and Live Preview.
- The default is enabled with `status` as the only selected field.
- User-configured fields control what appears on pretty links.
- Right-click exposes project actions and a **Note actions** path to standard Obsidian note actions.
