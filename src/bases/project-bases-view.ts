import {BasesView, Menu, QueryController, setIcon, setTooltip, TFile} from "obsidian";
import type {BasesEntry, BasesEntryGroup, BasesSortConfig} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {getStatusColor} from "../settings";
import {getNonEmptyProjectPropertyFieldIds, renderProjectControls} from "../ui/project-controls";
import type {ProjectControlField} from "../ui/project-controls";
import {createProjectTitleButton} from "../ui/project-icon";
import {renderProjectBoard} from "./project-board";
import {
	MIN_TABLE_COLUMN_WIDTH,
	normalizeTableColumnWidths,
	resetTableColumnWidth,
	setTableColumnWidth,
} from "./table-column-widths";
import type {TableColumnWidths} from "./table-column-widths";
import {getProjectTableClassName} from "./table-appearance";
import {
	BASES_ORDER_CONFIG_KEY,
	BASES_SORT_CONFIG_KEY,
	type BasesWritableSortConfig,
	getColumnSort,
	getNextColumnSortDirection,
	hideColumnFromOrder,
	normalizeTablePropertyOrder,
	normalizeTableSorts,
	setBasesPropertyOrder,
	setBasesSortProperty,
	sortProjectsByTableSort,
} from "./table-sorting";
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
const TABLE_COLUMN_WIDTHS_CONFIG_KEY = "spvTableColumnWidths";

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
		const columnWidths = this.getTableColumnWidths(columns);
		const sortedGroups = this.getTableGroups(groups, columns);

		const tableEl = this.containerEl.createEl("table", {
			cls: getProjectTableClassName(this.plugin.settings.showTableColumnDividers),
		});
		const columnEls = this.renderTableColumnGroup(tableEl, columns, columnWidths);
		const theadEl = tableEl.createEl("thead");
		const headRowEl = theadEl.createEl("tr");

		for (const column of columns) {
			this.renderTableHeader(headRowEl, column, columnEls.get(column.propertyId), columnWidths[column.propertyId]);
		}

		const tbodyEl = tableEl.createEl("tbody");
		for (const group of sortedGroups) {
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

	private renderTableColumnGroup(
		tableEl: HTMLTableElement,
		columns: ProjectViewColumn[],
		widths: TableColumnWidths,
	): Map<string, HTMLTableColElement> {
		const columnEls = new Map<string, HTMLTableColElement>();
		const colgroupEl = tableEl.createEl("colgroup");

		for (const column of columns) {
			const colEl = colgroupEl.createEl("col");
			const width = widths[column.propertyId];
			if (width !== undefined) {
				this.applyTableColumnWidth(colEl, width);
			}
			columnEls.set(column.propertyId, colEl);
		}

		return columnEls;
	}

	private renderTableHeader(
		rowEl: HTMLTableRowElement,
		column: ProjectViewColumn,
		colEl: HTMLTableColElement | undefined,
		width: number | undefined,
	): void {
		const headerEl = rowEl.createEl("th");
		headerEl.addClass("spv-project-table-resizable-header");
		if (width !== undefined) {
			this.applyTableColumnWidth(headerEl, width);
		}
		const sort = this.getColumnSort(column);
		headerEl.setAttribute("aria-sort", sort ? (sort.direction === "ASC" ? "ascending" : "descending") : "none");
		headerEl.addEventListener("contextmenu", (event) => this.showTableColumnMenu(event, column));
		const sortButtonEl = headerEl.createEl("button", {
			cls: "spv-table-header-button",
			attr: {
				type: "button",
				"aria-label": this.getTableSortButtonLabel(column, sort),
			},
		});
		sortButtonEl.addEventListener("click", (event) => {
			event.preventDefault();
			this.toggleTableColumnSort(column);
		});
		sortButtonEl.addEventListener("contextmenu", (event) => this.showTableColumnMenu(event, column));
		const labelEl = sortButtonEl.createSpan({cls: "spv-table-sort-label"});
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

		this.renderTableResizeHandle(headerEl, column, colEl);
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

	private getColumnSort(column: ProjectViewColumn): BasesWritableSortConfig | null {
		return getColumnSort(this.getTableSortConfig(), this.getColumnPropertyIds(column));
	}

	private getTableSortButtonLabel(column: ProjectViewColumn, sort: BasesWritableSortConfig | null): string {
		return sort?.direction === "ASC"
			? `Sort ${column.label} Z to A`
			: `Sort ${column.label} A to Z`;
	}

	private toggleTableColumnSort(column: ProjectViewColumn): void {
		const sorts = this.getTableSortConfig();
		const direction = getNextColumnSortDirection(sorts, this.getColumnPropertyIds(column));
		this.setTableColumnSort(column, direction);
	}

	private setTableColumnSort(column: ProjectViewColumn, direction: BasesSortConfig["direction"]): void {
		if (!setBasesSortProperty(this.config, column.propertyId, direction)) {
			this.setLegacyTableSortForCurrentSession(column, direction);
		}
		this.render();
	}

	private clearTableColumnSort(column: ProjectViewColumn): void {
		if (!setBasesSortProperty(this.config, column.propertyId, "NONE")) {
			this.setLegacyTableSortForCurrentSession(column, null);
		}
		this.render();
	}

	private hideTableColumn(column: ProjectViewColumn): void {
		const nextOrder = hideColumnFromOrder(this.getTableOrderConfig(), this.getColumnPropertyIds(column));
		if (!setBasesPropertyOrder(this.config, nextOrder)) {
			this.config.set(BASES_ORDER_CONFIG_KEY, nextOrder);
		}
		this.render();
	}

	private getColumnPropertyIds(column: ProjectViewColumn): string[] {
		return column.propertyId === column.configPropertyId
			? [column.propertyId]
			: [column.propertyId, column.configPropertyId];
	}

	private getTableSortConfig(): BasesWritableSortConfig[] {
		const columns = this.getViewProperties().tableColumns;
		const sort = this.config.getSort();
		if (sort.length > 0) {
			return normalizeTableSorts(sort, columns);
		}

		return normalizeTableSorts(this.getLegacyTableSortConfig(), columns);
	}

	private getLegacyTableSortConfig(): BasesWritableSortConfig[] {
		const sort = this.config.get(BASES_SORT_CONFIG_KEY);
		if (Array.isArray(sort)) {
			return sort.filter(isBasesSortConfig);
		}

		return [];
	}

	private getTableOrderConfig(): string[] {
		const columns = this.getViewProperties().tableColumns;
		const order = this.config.getOrder();
		if (order.length > 0) {
			return normalizeTablePropertyOrder(order, columns);
		}

		const legacyOrder = this.config.get(BASES_ORDER_CONFIG_KEY);
		if (Array.isArray(legacyOrder)) {
			return normalizeTablePropertyOrder(legacyOrder.filter(isBasesPropertyId), columns);
		}

		return [];
	}

	private setLegacyTableSortForCurrentSession(
		column: ProjectViewColumn,
		direction: BasesSortConfig["direction"] | null,
	): void {
		const sort = this.getTableSortConfig().filter((candidate) => !this.getColumnPropertyIds(column).includes(candidate.property));
		if (direction) {
			sort.unshift({property: column.propertyId, direction});
		}
		this.config.set(BASES_SORT_CONFIG_KEY, sort.length > 0 ? sort : null);
	}

	private getTableGroups(groups: ProjectGroup[], columns: ProjectViewColumn[]): ProjectGroup[] {
		const sort = this.getTableSortConfig();
		if (sort.length === 0) {
			return groups;
		}

		return groups.map((group) => ({
			...group,
			projects: sortProjectsByTableSort(group.projects, columns, sort),
		}));
	}

	private showTableColumnMenu(event: MouseEvent, column: ProjectViewColumn): void {
		event.preventDefault();
		event.stopPropagation();

		const sort = this.getColumnSort(column);
		const canHideColumn = this.getViewProperties().tableColumns.length > 1;
		const menu = Menu.forEvent(event);
		menu.addItem((item) => {
			item
				.setTitle("Hide column")
				.setIcon("eye-off")
				.setDisabled(!canHideColumn)
				.onClick(() => this.hideTableColumn(column));
		});
		menu.addSeparator();
		menu.addItem((item) => {
			item
				// Native Bases uses A/Z labels in the table header menu.
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setTitle("Sort A to Z")
				.setIcon("arrow-down-a-z")
				.setChecked(sort?.direction === "ASC")
				.onClick(() => this.setTableColumnSort(column, "ASC"));
		});
		menu.addItem((item) => {
			item
				// Native Bases uses A/Z labels in the table header menu.
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setTitle("Sort Z to A")
				.setIcon("arrow-down-z-a")
				.setChecked(sort?.direction === "DESC")
				.onClick(() => this.setTableColumnSort(column, "DESC"));
		});
		menu.addItem((item) => {
			item
				.setTitle("Clear sort")
				.setIcon("eraser")
				.setWarning(true)
				.setDisabled(!sort)
				.onClick(() => this.clearTableColumnSort(column));
		});
		menu.showAtMouseEvent(event);
	}

	private renderTableResizeHandle(
		headerEl: HTMLTableCellElement,
		column: ProjectViewColumn,
		colEl: HTMLTableColElement | undefined,
	): void {
		const handleEl = headerEl.createSpan({
			cls: "spv-table-resize-handle",
			attr: {
				"aria-label": `Resize ${column.label} column`,
				"aria-orientation": "vertical",
				role: "separator",
				tabindex: "0",
			},
		});
		handleEl.addEventListener("pointerdown", (event) => this.startTableColumnResize(event, handleEl, headerEl, column, colEl));
		handleEl.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			event.stopPropagation();
		});
		handleEl.addEventListener("dblclick", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.resetTableColumnWidth(column);
			headerEl.style.removeProperty("width");
			colEl?.style.removeProperty("width");
		});
		handleEl.addEventListener("keydown", (event) => this.handleTableResizeKey(event, headerEl, column, colEl));
	}

	private startTableColumnResize(
		event: PointerEvent,
		handleEl: HTMLElement,
		headerEl: HTMLTableCellElement,
		column: ProjectViewColumn,
		colEl: HTMLTableColElement | undefined,
	): void {
		if (event.button !== 0) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		const startX = event.clientX;
		const startWidth = this.getRenderedTableColumnWidth(headerEl, column);
		const ownerDocument = headerEl.ownerDocument;
		const pointerId = event.pointerId;
		let isResizing = true;
		let nextWidth = startWidth;
		ownerDocument.body.classList.add("spv-table-column-resizing");

		const handlePointerMove = (moveEvent: PointerEvent) => {
			if (!isResizing || moveEvent.pointerId !== pointerId) {
				return;
			}

			moveEvent.preventDefault();
			moveEvent.stopPropagation();
			nextWidth = Math.max(MIN_TABLE_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX);
			this.applyTableColumnWidth(headerEl, nextWidth);
			this.applyTableColumnWidth(colEl, nextWidth);
		};
		const finishResize = (finishEvent?: PointerEvent) => {
			if (!isResizing || (finishEvent && finishEvent.pointerId !== pointerId)) {
				return;
			}

			isResizing = false;
			ownerDocument.removeEventListener("pointermove", handlePointerMove, true);
			ownerDocument.removeEventListener("pointerup", finishResize, true);
			ownerDocument.removeEventListener("pointercancel", finishResize, true);
			handleEl.removeEventListener("lostpointercapture", finishResize);
			try {
				if (handleEl.hasPointerCapture(pointerId)) {
					handleEl.releasePointerCapture(pointerId);
				}
			} catch {
				// The browser may already have released capture after pointerup/cancel.
			}
			ownerDocument.body.classList.remove("spv-table-column-resizing");
			this.saveTableColumnWidth(column, nextWidth);
		};

		try {
			handleEl.setPointerCapture(pointerId);
		} catch {
			// Pointer capture is best-effort; document listeners still cover the drag.
		}
		ownerDocument.addEventListener("pointermove", handlePointerMove, true);
		ownerDocument.addEventListener("pointerup", finishResize, true);
		ownerDocument.addEventListener("pointercancel", finishResize, true);
		handleEl.addEventListener("lostpointercapture", finishResize);
	}

	private handleTableResizeKey(
		event: KeyboardEvent,
		headerEl: HTMLTableCellElement,
		column: ProjectViewColumn,
		colEl: HTMLTableColElement | undefined,
	): void {
		if (event.key === "Enter" || event.key === "Backspace" || event.key === "Delete") {
			event.preventDefault();
			this.resetTableColumnWidth(column);
			headerEl.style.removeProperty("width");
			colEl?.style.removeProperty("width");
			return;
		}

		const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
		if (direction === 0) {
			return;
		}

		event.preventDefault();
		const nextWidth = this.getRenderedTableColumnWidth(headerEl, column) + direction * 24;
		this.applyTableColumnWidth(headerEl, nextWidth);
		this.applyTableColumnWidth(colEl, nextWidth);
		this.saveTableColumnWidth(column, nextWidth);
	}

	private getTableColumnWidths(columns: ProjectViewColumn[]): TableColumnWidths {
		return normalizeTableColumnWidths(
			this.config.get(TABLE_COLUMN_WIDTHS_CONFIG_KEY),
			columns.map((column) => column.propertyId),
		);
	}

	private saveTableColumnWidth(column: ProjectViewColumn, width: number): void {
		const columns = this.getViewProperties().tableColumns;
		const widths = this.getTableColumnWidths(columns);
		const nextWidths = setTableColumnWidth(widths, column.propertyId, width);
		this.config.set(TABLE_COLUMN_WIDTHS_CONFIG_KEY, nextWidths);
	}

	private resetTableColumnWidth(column: ProjectViewColumn): void {
		const columns = this.getViewProperties().tableColumns;
		const widths = this.getTableColumnWidths(columns);
		const nextWidths = resetTableColumnWidth(widths, column.propertyId);
		this.config.set(TABLE_COLUMN_WIDTHS_CONFIG_KEY, Object.keys(nextWidths).length === 0 ? null : nextWidths);
	}

	private getRenderedTableColumnWidth(headerEl: HTMLTableCellElement, column: ProjectViewColumn): number {
		const widths = this.getTableColumnWidths(this.getViewProperties().tableColumns);
		return widths[column.propertyId] ?? headerEl.getBoundingClientRect().width;
	}

	private applyTableColumnWidth(element: HTMLElement | undefined, width: number): void {
		element?.style.setProperty("width", `${Math.max(MIN_TABLE_COLUMN_WIDTH, Math.round(width))}px`);
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

function isBasesSortConfig(value: unknown): value is BasesWritableSortConfig {
	if (!value || typeof value !== "object") {
		return false;
	}

	const sort = value as Partial<BasesSortConfig>;
	return typeof sort.property === "string" && (sort.direction === "ASC" || sort.direction === "DESC");
}

function isBasesPropertyId(value: unknown): value is string {
	return typeof value === "string";
}
