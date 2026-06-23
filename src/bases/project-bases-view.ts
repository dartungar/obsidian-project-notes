import {BasesView, QueryController, setIcon, setTooltip, TFile} from "obsidian";
import type {BasesEntry, BasesEntryGroup, BasesSortConfig} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {getStatusColor} from "../settings";
import {getNonEmptyProjectPropertyFieldIds, renderProjectControls} from "../ui/project-controls";
import type {ProjectControlField} from "../ui/project-controls";
import {createProjectTitleButton} from "../ui/project-icon";
import {renderProjectBoard} from "./project-board";
import {resolveProjectViewProperties} from "./view-properties";
import type {ProjectViewColumn, ResolvedProjectViewProperties} from "./view-properties";

export type ProjectBasesVariant = "list" | "table" | "board";

interface ProjectGroup {
	hasHeading: boolean;
	label: string;
	projects: ProjectInfo[];
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
		const viewProperties = this.getViewProperties();
		const groups = this.variant === "board" ? [] : this.getProjectGroups();
		const projects = this.variant === "board"
			? this.getBoardProjects()
			: getProjectsFromGroups(groups);

		if (projects.length === 0) {
			this.containerEl.createDiv({
				cls: "spv-empty-state",
				text: "No projects match this Base.",
			});
			return;
		}

		if (this.variant === "board") {
			this.renderBoard(projects, viewProperties);
			return;
		}

		if (this.variant === "table") {
			this.renderTable(groups, viewProperties);
			return;
		}

		this.renderList(groups, viewProperties);
	}

	private getProjectGroups(): ProjectGroup[] {
		const seenPaths = new Set<string>();

		return this.data.groupedData
			.map((group) => ({
				hasHeading: group.hasKey(),
				label: getGroupLabel(group),
				projects: this.getProjectsFromEntries(group.entries, seenPaths),
			}))
			.filter((group) => group.projects.length > 0);
	}

	private getBoardProjects(): ProjectInfo[] {
		return this.getProjectsFromEntries(this.data.data);
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

	private renderList(groups: ProjectGroup[], viewProperties: ResolvedProjectViewProperties): void {
		const listEl = this.containerEl.createDiv({cls: "spv-bases-list"});

		for (const group of groups) {
			if (group.hasHeading) {
				this.renderGroupHeading(listEl, group.label);
			}

			for (const project of group.projects) {
				this.renderListProject(listEl, project, viewProperties);
			}
		}
	}

	private renderTable(groups: ProjectGroup[], viewProperties: ResolvedProjectViewProperties): void {
		const columns = viewProperties.tableColumns;

		const tableEl = this.containerEl.createEl("table", {cls: "spv-project-table"});
		const theadEl = tableEl.createEl("thead");
		const headRowEl = theadEl.createEl("tr");

		for (const column of columns) {
			this.renderTableHeader(headRowEl, column);
		}

		const tbodyEl = tableEl.createEl("tbody");
		for (const group of groups) {
			if (group.hasHeading) {
				const groupRowEl = tbodyEl.createEl("tr", {cls: "spv-table-group-row"});
				groupRowEl.createEl("td", {
					attr: {colspan: String(columns.length)},
					text: group.label,
				});
			}

			for (const project of group.projects) {
				const rowEl = tbodyEl.createEl("tr");
				for (const column of columns) {
					this.renderTableCell(rowEl, project, column);
				}
			}
		}
	}

	private renderBoard(projects: ProjectInfo[], viewProperties: ResolvedProjectViewProperties): void {
		renderProjectBoard(this.containerEl, this.plugin, projects, {
			fields: viewProperties.controlFields,
			labels: this.getFieldLabels(),
			showTitleIcon: viewProperties.showTitleIcon,
		});
	}

	private renderListProject(
		containerEl: HTMLElement,
		project: ProjectInfo,
		viewProperties: ResolvedProjectViewProperties,
	): void {
		const isEditing = this.editingListProjects.has(project.file.path);
		const canEdit = viewProperties.controlFields.length > 0;
		const showStatus = viewProperties.controlFields.includes("status");
		const rowEl = containerEl.createDiv({cls: "spv-bases-row spv-bases-row-compact"});
		rowEl.classList.toggle("is-editing", isEditing);

		const headerEl = rowEl.createDiv({cls: "spv-list-row-header"});
		createProjectTitleButton(headerEl, project, () => {
			void this.app.workspace.getLeaf(false).openFile(project.file);
		}, {
			showIcon: viewProperties.showTitleIcon,
		});

		if (showStatus || canEdit) {
			const actionsEl = headerEl.createDiv({cls: "spv-list-row-actions"});
			if (showStatus) {
				this.renderStatusBadge(actionsEl, project.status);
			}

			if (canEdit) {
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
			}
		}

		if (isEditing && canEdit) {
			const editPanelEl = rowEl.createDiv({cls: "spv-list-edit-panel"});
			renderProjectControls(editPanelEl, this.plugin.app, this.plugin.settings, project, {
				controlClass: "spv-list-edit-controls",
				fields: viewProperties.controlFields,
				labels: this.getFieldLabels(),
				afterUpdate: () => this.plugin.refreshProjectSurfaces(),
			});
			return;
		}

		renderProjectControls(rowEl, this.plugin.app, this.plugin.settings, project, {
			controlClass: "spv-list-readonly-controls",
			fields: this.getVisibleListSummaryFields(project, viewProperties.controlFields),
			labels: this.getFieldLabels(),
			readOnly: true,
		});
	}

	private renderTableHeader(rowEl: HTMLTableRowElement, column: ProjectViewColumn): void {
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

	private renderTableCell(rowEl: HTMLTableRowElement, project: ProjectInfo, column: ProjectViewColumn): void {
		const cellEl = rowEl.createEl("td");
		if (column.key === "title") {
			createProjectTitleButton(cellEl, project, () => {
				void this.app.workspace.getLeaf(false).openFile(project.file);
			}, {
				showIcon: false,
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

	private getColumnSort(column: ProjectViewColumn): BasesSortConfig | null {
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

	private getViewProperties(): ResolvedProjectViewProperties {
		return resolveProjectViewProperties(
			this.plugin.settings,
			this.config.getOrder(),
			(propertyId) => this.config.getDisplayName(propertyId),
		);
	}

	private getVisibleListSummaryFields(project: ProjectInfo, fields: ProjectControlField[]): ProjectControlField[] {
		const nonEmptyFields = new Set(getNonEmptyProjectPropertyFieldIds(project));

		return fields.filter((field) => field !== "icon" && field !== "status" && nonEmptyFields.has(field));
	}

	private renderGroupHeading(containerEl: HTMLElement, label: string): void {
		containerEl.createDiv({
			cls: "spv-bases-group-heading",
			text: label,
		});
	}
}

function getGroupLabel(group: BasesEntryGroup): string {
	if (!group.hasKey()) {
		return "";
	}

	const label = group.key?.toString().trim() ?? "";
	return label || "No value";
}

function getProjectsFromGroups(groups: ProjectGroup[]): ProjectInfo[] {
	const projects: ProjectInfo[] = [];
	for (const group of groups) {
		projects.push(...group.projects);
	}

	return projects;
}
