# Project Notes

Project Notes is an opinionated plugin for simple, lightweight note-based project management (1 note = 1 project).

Your Markdown files stay the source of truth. The plugin only provides convenience and visuals, and aims to leave as little footprint as possible.

## How it works

Project Notes treats selected notes as projects. By default, any note tagged `#project` is a project, but you can also match projects by a note property or by folder.

Project metadata is stored in frontmatter. The plugin reads and writes those properties, then adds focused project UI on top of normal Markdown notes:

- A note bar for editing project metadata directly inside project notes.
- Pretty project links that show selected project fields next to links in Reading view and Live Preview.
- Project list, table, and board layouts for Obsidian Bases.
- Commands for creating projects, creating child projects, creating a ready-to-edit `.base` file, refreshing views, and repairing duplicate properties.

The **Create project** command uses a configurable path template and optional Markdown template file. Useful tokens include `{{title}}`, `{{safe_title}}`, `{{slug}}`, `{{project_folder}}`, `{{project_properties}}`, `{{icon}}`, `{{icon_property}}`, `{{status}}`, `{{status_property}}`, `{{date}}`, and tokens derived from configured property IDs, labels, and note property names.

## Properties

Status, progress, and due date are the default properties. Status is special because it drives project controls and board columns. Project icon is a separate built-in field that can be turned off.

Other project properties can be added in **Settings → Project Notes → Properties** and then renamed, retyped, reordered, and rendered in different ways. Property values can render as text fields, text areas, dates, date/times, progress bars, or stars.

```yaml
---
tags:
  - project
icon: folder-kanban
status: in-progress
progress: 50
due: 2026-06-01
---
```

The default property set is only a starting point. You can rename the underlying note properties, choose which fields appear in links and relationships, and add your own fields for the way you manage projects.


Settings: customize project properties, statuses, views, and relationships
<img width="672" height="547" alt="Settings screen for Project Notes" src="https://github.com/user-attachments/assets/c49f1231-d439-4f81-8492-69af4be63772" />


Pretty project links: show project properties inline
<img width="1043" height="310" alt="Pretty project links showing project metadata inline" src="https://github.com/user-attachments/assets/f94d10d8-9150-45ab-bab7-048810b1ce9b" />

Right-click a pretty project link to update status or clear configured project properties without opening the project note.

## Note bar

The note bar gives each project note a compact editor for status, icon, progress, due date, and any custom project properties you add. 
It can be placed at the top, bottom, left, or right of project notes (or disabled completely; see Settings).


<img width="831" height="498" alt="Project note bar for editing project properties" src="https://github.com/user-attachments/assets/c4bbe41c-e51b-4452-b390-796fdf89fac0" />


## Views

Project Notes adds custom Obsidian Bases layouts for working across many project notes:

- Project list, useful for sidebars and embedded views.
- Editable project table that follows the Bases sort menu.
- Project board grouped by status.

You can create a `.base` file preconfigured for your project criteria, reorder board columns and cards, collapse columns, tune card spacing, tint the board with status colors, resize table columns, and show or hide table column dividers.

You can also use other views as you please (but withour pretty property renderings).

Board Bases view: grouped by status, colorful or plain
<img width="1463" height="486" alt="Project board Bases view grouped by status" src="https://github.com/user-attachments/assets/60cb8dd2-1845-4e17-b16c-e97897f5ce82" />


List Bases view: compact enough for sidebars and embeds

<img width="412" height="383" alt="Project list Bases view" src="https://github.com/user-attachments/assets/6cc5ffe4-81a3-438d-81ce-1c7cc21dca9d" />

## Relationships

Relationships are stored as normal links in note properties. By default, `parent` stores one parent project link and `children` stores a list of child project links.

When relationships are enabled, project notes can show their parent, children, and selected detail fields such as status. The **Create child project** command creates a new project note and updates both sides of the relationship.

```yaml
---
parent: "[[Website refresh]]"
children:
  - "[[Draft landing page copy]]"
---
```

## Commands

- **Create project**
- **Create child project**
- **Create project base**
- **Refresh project views**
- **Repair current note project properties**

## Development

Install dependencies:

```bash
npm install
```

Run the development build:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```
