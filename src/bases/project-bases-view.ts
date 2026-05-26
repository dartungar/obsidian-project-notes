import {BasesView, QueryController, setIcon, setTooltip, TFile} from "obsidian";
import type {BasesEntry, BasesPropertyId, BasesSortConfig} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {getStatusColor} from "../settings";
import {getNonEmptyProjectPropertyFieldIds, renderProjectControls} from "../ui/project-controls";
import type {ProjectControlField} from "../ui/project-controls";
import {createProjectTitleButton} from "../ui/project-icon";
import {renderProjectBoard} from "./project-board";

export type ProjectBasesVariant = "list" | "table" | "board";

interface ProjectTableColumn {
	key: string;
	label: string;
	propertyId: BasesPropertyId;
	field?: ProjectControlField;
}

const TABLE_FIELD_LABELS: Partial<Record<ProjectControlField, string>> = {
	status: "Status",
};

export class ProjectBasesView extends BasesView {
	readonly type: string;
	private readonly containerEl: HTMLElement;
	private readonly editingListProjects = new Set<string>();

	constructor(
		controller: QueryController,
		parentEl: HTMLElement,
		private readonly plugin: SimpleProjectViewsPlugin,
		type: string,
		private readonly variant: ProjectBasesVariant,
	) {
		super(controller);
		this.type = type;
		this.containerEl = parentEl.createDiv({cls: `spv-bases-view spv-bases-view-${variant}`});
		this.plugin.registerProjectBasesView(this);
		this.register(() => this.plugin.unregisterProjectBasesView(this));
	}

	public onDataUpdated(): void {
		this.render();
	}

	public render(): void {
		this.containerEl.empty();
		const projects = this.variant === "table"
			? this.getProjectsFromEntries(this.data.data)
			: this.getProjectsFromData();

		if (projects.length === 0) {
			this.containerEl.createDiv({
				cls: "spv-empty-state",
				text: "No projects match this Base.",
			});
			return;
		}

		if (this.variant === "board") {
			this.renderBoard(projects);
			return;
		}

		if (this.variant === "table") {
			this.renderTable(projects);
			return;
		}

		this.renderList(projects);
	}

	private getProjectsFromData(): ProjectInfo[] {
		const projects: ProjectInfo[] = [];
		const seenPaths = new Set<string>();

		for (const group of this.data.groupedData) {
			projects.push(...this.getProjectsFromEntries(group.entries, seenPaths));
		}

		return projects;
	}

	private getProjectsFromEntries(entries: BasesEntry[], seenPaths = new Set<string>()): ProjectInfo[] {
		const projects: ProjectInfo[] = [];

		for (const entry of entries) {
			if (!(entry.file instanceof TFile) || seenPaths.has(entry.file.path)) {
				continue;
			}

			const project = this.plugin.projectIndex.getProject(entry.file);
			if (project) {
				seenPaths.add(project.file.path);
				projects.push(project);
			}
		}

		return projects;
	}

	private renderList(projects: ProjectInfo[]): void {
		const listEl = this.containerEl.createDiv({cls: "spv-bases-list"});

		for (const project of projects) {
			this.renderListProject(listEl, project);
		}
	}

	private renderTable(projects: ProjectInfo[]): void {
		const columns = this.getTableColumns();

		const tableEl = this.containerEl.createEl("table", {cls: "spv-project-table"});
		const theadEl = tableEl.createEl("thead");
		const headRowEl = theadEl.createEl("tr");

		for (const column of columns) {
			this.renderTableHeader(headRowEl, column);
		}

		const tbodyEl = tableEl.createEl("tbody");
		for (const project of projects) {
			const rowEl = tbodyEl.createEl("tr");
			for (const column of columns) {
				this.renderTableCell(rowEl, project, column);
			}
		}
	}

	private renderBoard(projects: ProjectInfo[]): void {
		renderProjectBoard(this.containerEl, this.plugin, projects);
	}

	private renderListProject(containerEl: HTMLElement, project: ProjectInfo): void {
		const isEditing = this.editingListProjects.has(project.file.path);
		const rowEl = containerEl.createDiv({cls: "spv-bases-row spv-bases-row-compact"});
		rowEl.classList.toggle("is-editing", isEditing);

		const headerEl = rowEl.createDiv({cls: "spv-list-row-header"});
		createProjectTitleButton(headerEl, project, () => {
			void this.app.workspace.getLeaf(false).openFile(project.file);
		});

		const actionsEl = headerEl.createDiv({cls: "spv-list-row-actions"});
		this.renderStatusBadge(actionsEl, project.status);
		const editButtonEl = actionsEl.createEl("button", {
			cls: "clickable-icon spv-list-row-edit",
			attr: {"aria-label": `${isEditing ? "Finish editing" : "Edit"} ${project.title}`},
		});
		setIcon(editButtonEl, isEditing ? "check" : "pencil");
		editButtonEl.addEventListener("click", () => {
			if (isEditing) {
				this.editingListProjects.delete(project.file.path);
			} else {
				this.editingListProjects.add(project.file.path);
			}
			this.render();
		});

		if (isEditing) {
			const editPanelEl = rowEl.createDiv({cls: "spv-list-edit-panel"});
			renderProjectControls(editPanelEl, this.plugin.app, this.plugin.settings, project, {
				controlClass: "spv-list-edit-controls",
				labels: this.getFieldLabels(),
				afterUpdate: () => this.plugin.refreshProjectSurfaces(),
			});
			return;
		}

		renderProjectControls(rowEl, this.plugin.app, this.plugin.settings, project, {
			controlClass: "spv-list-readonly-controls",
			fields: getNonEmptyProjectPropertyFieldIds(project),
			labels: this.getFieldLabels(),
			readOnly: true,
		});
	}

	private getTableColumns(): ProjectTableColumn[] {
		const defaultColumns: ProjectTableColumn[] = [
			{key: "title", label: "Project", propertyId: "file.name"},
		];
		if (this.plugin.settings.enabledProperties.icon && this.plugin.settings.propertyNames.icon.trim()) {
			defaultColumns.push({
				key: "icon",
				label: "Icon",
				field: "icon",
				propertyId: getNotePropertyId(this.plugin.settings.propertyNames.icon),
			});
		}
		defaultColumns.push({key: "status", label: "Status", field: "status", propertyId: getNotePropertyId(this.plugin.settings.propertyNames.status)});
		for (const property of this.plugin.settings.projectProperties) {
			if (!property.name.trim()) {
				continue;
			}

			defaultColumns.push({
				key: property.id,
				label: property.label,
				field: property.id,
				propertyId: getNotePropertyId(property.name),
			});
		}

		const columnsByProperty = new Map(defaultColumns.map((column) => [column.propertyId, column]));
		const orderedColumns = this.config
			.getOrder()
			.map((propertyId) => columnsByProperty.get(propertyId))
			.filter((column): column is ProjectTableColumn => column !== undefined);
		const orderedPropertyIds = new Set(orderedColumns.map((column) => column.propertyId));
		const missingColumns = defaultColumns.filter((column) => !orderedPropertyIds.has(column.propertyId));

		return this.withConfiguredDisplayNames([...orderedColumns, ...missingColumns]);
	}

	private withConfiguredDisplayNames(columns: ProjectTableColumn[]): ProjectTableColumn[] {
		return columns.map((column) => ({
			...column,
			label: this.config.getDisplayName(column.propertyId) || column.label,
		}));
	}

	private renderTableHeader(rowEl: HTMLTableRowElement, column: ProjectTableColumn): void {
		const headerEl = rowEl.createEl("th");
		const sort = this.getColumnSort(column);
		headerEl.setAttribute("aria-sort", sort ? (sort.direction === "ASC" ? "ascending" : "descending") : "none");
		const labelEl = headerEl.createSpan({cls: "spv-table-sort-label"});
		const property = column.field
			? this.plugin.settings.projectProperties.find((candidate) => candidate.id === column.field)
			: null;
		if (property?.labelMode === "icon" && property.icon) {
			const propertyIconEl = labelEl.createSpan({
				cls: "spv-table-property-icon",
				attr: {
					"aria-label": column.label,
					"data-tooltip": column.label,
					title: column.label,
				},
			});
			setIcon(propertyIconEl, property.icon);
			setTooltip(propertyIconEl, column.label, {placement: "top"});
		} else {
			labelEl.createSpan({text: column.label});
		}

		if (sort) {
			const iconEl = labelEl.createSpan({cls: "spv-table-sort-icon", attr: {"aria-hidden": "true"}});
			setIcon(iconEl, sort.direction === "ASC" ? "arrow-up" : "arrow-down");
		}
	}

	private renderTableCell(rowEl: HTMLTableRowElement, project: ProjectInfo, column: ProjectTableColumn): void {
		const cellEl = rowEl.createEl("td");
		if (column.key === "title") {
			createProjectTitleButton(cellEl, project, () => {
				void this.app.workspace.getLeaf(false).openFile(project.file);
			});
			return;
		}

		if (!column.field) {
			return;
		}

		renderProjectControls(cellEl, this.plugin.app, this.plugin.settings, project, {
			fields: [column.field],
			controlClass: "spv-table-controls",
			labels: this.getFieldLabels(),
			afterUpdate: () => this.plugin.refreshProjectSurfaces(),
		});
	}

	private getColumnSort(column: ProjectTableColumn): BasesSortConfig | null {
		return this.config.getSort().find((sort) => sort.property === column.propertyId) ?? null;
	}

	private renderStatusBadge(containerEl: HTMLElement, status: string): void {
		const badgeEl = containerEl.createSpan({
			cls: "spv-status-badge",
			text: status || "No status",
		});
		badgeEl.style.setProperty("--spv-status-color", getStatusColor(this.plugin.settings, status));
	}

	private getFieldLabels(): Partial<Record<ProjectControlField, string>> {
		const labels: Partial<Record<ProjectControlField, string>> = {...TABLE_FIELD_LABELS};

		for (const property of this.plugin.settings.projectProperties) {
			labels[property.id] = property.label;
		}

		return labels;
	}
}

function getNotePropertyId(propertyName: string): BasesPropertyId {
	return `note.${propertyName}` as BasesPropertyId;
}
