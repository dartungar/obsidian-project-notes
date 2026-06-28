# Project Notes

Project Notes adds project controls, relationship links, pretty project links, and custom Bases views to ordinary Obsidian notes.

Your Markdown files stay the source of truth. The plugin reads and writes note properties, recognizes project notes using your criteria, and makes project metadata easier to edit from notes, links, lists, tables, and boards.

## Screenshots

`<screenshot of a project note with the note bar, status, progress, and relationships>`

`<screenshot of a Project Notes board grouped by status>`

`<screenshot of a Project Notes table with editable project properties>`

`<screenshot of pretty project links inside a note>`

`<screenshot of Project Notes settings tabs>`

## How it works

Project Notes treats selected notes as projects. By default, any note tagged `#project` is a project, but you can also match projects by a note property or by folder.

Project metadata is stored in frontmatter. Status, icon, progress, due date, delegated owner, follow-up date, next action, blocked reason, parent project, and child projects are all plain note properties that you can rename or customize.

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
