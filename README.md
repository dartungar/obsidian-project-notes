# Simple Project Views

Simple Project Views adds lightweight project controls and project-aware views for Obsidian notes.

The plugin keeps your Markdown notes as the source of truth. It reads and writes note properties, detects project notes using configurable criteria, and exposes the same project metadata through a note toolbar and custom Bases layouts.

## Features

- Configurable project matching by tag, note property, or folder path, with `#project` as the default.
- Project note toolbar for project icon, status, and any configured project properties, with top, bottom, left, or right placement.
- Pretty project links in Reading view and Live Preview, with configurable fields and project actions.
- Arbitrary project properties with configurable note property names, value types, render modes, and optional label icons.
- Create project command with configurable path and optional template file.
- Custom Bases layouts:
	- Compact project list
	- Editable project table that follows the Bases sort menu
	- Project board
- Command to create a ready-to-edit `.base` file using your project criteria.

## Default properties

Status is special because it drives project controls and board columns. Project icon is a built-in field that can be turned off. All other project properties are configurable in **Settings → Simple Project Views → Properties** and can be added, removed, renamed, retyped, and rendered as progress bars, stars, text fields, text areas, dates, or date/times. Each property can show its name or an icon in project views.

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
---
```

The default property set matches earlier versions, but it is only a starting point.

## Create project template

The create project command uses a configurable path template and optional Markdown template file. Useful tokens include `{{title}}`, `{{safe_title}}`, `{{slug}}`, `{{project_folder}}`, `{{project_properties}}`, `{{icon}}`, `{{icon_property}}`, `{{status}}`, `{{status_property}}`, `{{date}}`, and tokens derived from configured property IDs, labels, and note property names.

## Commands

- **Create project**
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
