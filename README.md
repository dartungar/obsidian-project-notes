# Project Notes

Project Notes is an opinionated plugin for simple, lightweight note-based project management (1 note = 1 project).

Your Markdown files stay the source of truth. The plugin only provides convenience and visuals, and aims to lease as little footprint as possible.

## Screenshots
##### Note bar: edit project properties
<img width="831" height="498" alt="image" src="https://github.com/user-attachments/assets/c4bbe41c-e51b-4452-b390-796fdf89fac0" />


##### Kanban board bases view (can be colorful, or not)
<img width="1463" height="486" alt="image" src="https://github.com/user-attachments/assets/60cb8dd2-1845-4e17-b16c-e97897f5ce82" />


##### List bases view (good for sidebars and embedding)
<img width="412" height="383" alt="image" src="https://github.com/user-attachments/assets/6cc5ffe4-81a3-438d-81ce-1c7cc21dca9d" />


##### Pretty Project links (RMB to edit project properties)
<img width="1043" height="310" alt="image" src="https://github.com/user-attachments/assets/f94d10d8-9150-45ab-bab7-048810b1ce9b" />


##### Settings (customize almost anything)
<img width="672" height="547" alt="image" src="https://github.com/user-attachments/assets/c49f1231-d439-4f81-8492-69af4be63772" />


## How it works

Project Notes treats selected notes as projects. By default, any note tagged `#project` is a project, but you can also match projects by a note property or by folder.

Project metadata is stored in frontmatter. "Status" is required for board, other properties can be added/deleted as needed.

The plugin adds focused project UI on top of those properties:

- A note bar for editing project metadata directly inside project notes.
- Pretty project links that show project fields next to links in Reading view and Live Preview.
- Project list, table, and board layouts for Obsidian Bases.
- Commands for creating projects, creating child projects, creating a ready-to-edit `.base` file, refreshing views, and repairing duplicate properties.

## Features

- Match project notes by tag, note property, or folder path.
- Edit status, icon, and custom project properties from a project note bar.
- Place the note bar at the top, bottom, left, or right of project notes.
- Create projects with a configurable path template and optional Markdown template file.
- Create child projects from a project note and automatically write parent/child links.
- Show parent and child project links, with configurable related-project detail fields.
- Render links to project notes as compact pretty project links.
- Configure pretty link fields and whether property names appear.
- Create arbitrary project properties with custom note property names, labels, types, render modes, and label icons.
- Render project properties as text fields, text areas, dates, date/times, progress bars, or stars.
- Customize statuses, status colors, status display style, and status order.
- Use custom Bases layouts:
  - Project list
  - Editable project table that follows the Bases sort menu
  - Project board grouped by status
- Reorder board columns and cards, collapse columns, tune card spacing, and optionally tint the board with status colors.
- Resize project table columns and show or hide table column dividers.
- Create a `.base` file preconfigured for your project criteria.
- Repair duplicate project properties on the current note.

## Default properties

Status is special because it drives project controls and board columns. Project icon is a built-in field that can be turned off. All other project properties are configurable in **Settings → Project Notes → Properties** and can be added, removed, renamed, retyped, reordered, and rendered in different ways.

```yaml
---
tags:
  - project
icon: folder-kanban
status: in-progress
progress: 50
due: 2026-06-01
delegated_to: Alex
follow_up: 2026-05-27
next_action: Email Alex about the draft
blocked_reason:
parent: "[[Website refresh]]"
children:
  - "[[Draft landing page copy]]"
---
```

The default property set is only a starting point. You can rename the underlying note properties, choose which fields appear in links and relationships, and add your own fields for the way you manage projects.

## Project relationships

Relationships are stored as normal links in note properties. By default, `parent` stores one parent project link and `children` stores a list of child project links.

When relationships are enabled, project notes can show their parent, children, and selected detail fields such as status. The **Create child project** command creates a new project note and updates both sides of the relationship.

## Create project template

The **Create project** command uses a configurable path template and optional Markdown template file. Useful tokens include `{{title}}`, `{{safe_title}}`, `{{slug}}`, `{{project_folder}}`, `{{project_properties}}`, `{{icon}}`, `{{icon_property}}`, `{{status}}`, `{{status_property}}`, `{{date}}`, and tokens derived from configured property IDs, labels, and note property names.

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
