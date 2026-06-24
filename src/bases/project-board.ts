import {Notice, setIcon} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {updateProjectProperty} from "../project-metadata";
import {getStatusColor} from "../settings";
import {getNonEmptyProjectPropertyFieldIds, renderProjectControls} from "../ui/project-controls";
import type {ProjectControlField} from "../ui/project-controls";
import {createProjectTitleButton} from "../ui/project-icon";
import {getBoardClassName} from "./board-appearance";

const PROJECT_DRAG_TYPE = "application/x-simple-project-views-project";
const COLUMN_DRAG_TYPE = "application/x-simple-project-views-column";

type ReorderPlacement = "before" | "after";
interface ProjectDropTarget {
	path?: string;
	placement?: ReorderPlacement;
	status: string;
}

interface ProjectBoardRenderOptions {
	fields: ProjectControlField[];
	labels: Partial<Record<ProjectControlField, string>>;
	showTitleIcon: boolean;
}

const editingBoardCards = new Set<string>();

export function renderProjectBoard(
	containerEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	projects: ProjectInfo[],
	options: ProjectBoardRenderOptions,
): void {
	const orderedProjects = getOrderedBoardProjects(projects, plugin.settings.boardCardOrder);
	const statuses = getBoardStatuses(plugin.settings.statusOptions, projects, plugin.settings.boardColumnOrder);
	const collapsedStatuses = new Set(plugin.settings.collapsedBoardColumns);
	const boardEl = containerEl.createDiv({cls: getBoardClassName(plugin.settings.colorfulBoard, plugin.settings.boardCardLayout)});
	boardEl.style.setProperty("--spv-board-column-width", `${plugin.settings.boardColumnWidth}px`);

	for (const status of statuses) {
		renderBoardColumn(boardEl, plugin, orderedProjects, statuses, status, collapsedStatuses.has(status), options);
	}
}

function renderBoardColumn(
	boardEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	projects: ProjectInfo[],
	statuses: string[],
	status: string,
	isCollapsed: boolean,
	options: ProjectBoardRenderOptions,
): void {
	const columnProjects = projects.filter((project) => getBoardStatus(project.status, plugin.settings.statusOptions) === status);
	const title = status || "No status";
	const columnEl = boardEl.createDiv({cls: "spv-board-column"});
	columnEl.classList.toggle("spv-board-column-collapsed", isCollapsed);
	columnEl.setAttribute("data-spv-board-status", status);
	columnEl.style.setProperty("--spv-status-color", getStatusColor(plugin.settings, status));

	columnEl.addEventListener("dragover", (event) => {
		handleColumnDragOver(event, boardEl, columnEl);
	});
	columnEl.addEventListener("dragleave", (event) => {
		if (!event.relatedTarget || !columnEl.contains(event.relatedTarget as Node)) {
			clearDropClasses(boardEl);
		}
	});
	columnEl.addEventListener("drop", (event) => {
		void handleColumnDrop(event, boardEl, columnEl, plugin, projects, statuses, status);
	});

	const headerEl = columnEl.createDiv({cls: "spv-board-column-header"});
	const collapseButtonEl = headerEl.createEl("button", {
		cls: "clickable-icon spv-board-column-toggle",
		attr: {
			"aria-expanded": String(!isCollapsed),
			"aria-label": `${isCollapsed ? "Expand" : "Collapse"} ${title}`,
		},
	});
	setIcon(collapseButtonEl, isCollapsed ? "chevron-right" : "chevron-down");
	collapseButtonEl.addEventListener("click", (event) => {
		event.stopPropagation();
		void setColumnCollapsed(plugin, status, !isCollapsed);
	});

	const titleEl = headerEl.createDiv({cls: "spv-board-column-title"});
	titleEl.createEl("h3", {text: title});
	titleEl.createSpan({cls: "spv-board-column-count", text: String(columnProjects.length)});

	const dragHandleEl = headerEl.createEl("button", {
		cls: "clickable-icon spv-board-column-drag-handle",
		attr: {"aria-label": `Move ${title} column`},
	});
	setIcon(dragHandleEl, "grip-vertical");
	dragHandleEl.draggable = true;
	dragHandleEl.addEventListener("dragstart", (event) => {
		event.stopPropagation();
		if (!event.dataTransfer) {
			return;
		}

		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData(COLUMN_DRAG_TYPE, status);
		columnEl.addClass("spv-board-column-dragging");
	});
	dragHandleEl.addEventListener("dragend", () => {
		clearDropClasses(boardEl);
		columnEl.removeClass("spv-board-column-dragging");
	});

	if (isCollapsed) {
		return;
	}

	const bodyEl = columnEl.createDiv({cls: "spv-board-column-body"});
	for (const project of columnProjects) {
		renderBoardCard(bodyEl, plugin, projects, project, status, options);
	}
	bodyEl.createDiv({
		cls: "spv-board-card-placeholder",
		attr: {"aria-hidden": "true"},
	});
}

function renderBoardCard(
	containerEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	projects: ProjectInfo[],
	project: ProjectInfo,
	columnStatus: string,
	options: ProjectBoardRenderOptions,
): void {
	const isEditing = editingBoardCards.has(project.file.path);
	const cardEl = containerEl.createDiv({cls: "spv-board-card"});
	cardEl.classList.toggle("spv-board-card-editing", isEditing);
	cardEl.setAttribute("data-spv-project-path", project.file.path);
	cardEl.draggable = true;
	cardEl.addEventListener("pointerdown", (event) => {
		if (isCardDragSuppressed(event.target)) {
			cardEl.draggable = false;
		}
	}, {capture: true});
	cardEl.addEventListener("pointerup", () => {
		cardEl.draggable = true;
	}, {capture: true});
	cardEl.addEventListener("pointercancel", () => {
		cardEl.draggable = true;
	}, {capture: true});
	cardEl.addEventListener("dragstart", (event) => {
		if (isCardDragSuppressed(event.target)) {
			event.preventDefault();
			return;
		}

		if (!event.dataTransfer) {
			return;
		}

		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData(PROJECT_DRAG_TYPE, project.file.path);
		setBoardCardDragActive(cardEl, true);
		cardEl.addClass("spv-board-card-dragging");
	});
	cardEl.addEventListener("dragend", () => {
		cardEl.draggable = true;
		setBoardCardDragActive(cardEl, false);
		cardEl.removeClass("spv-board-card-dragging");
	});
	cardEl.addEventListener("dragover", (event) => {
		handleCardDragOver(event, cardEl);
	});
	cardEl.addEventListener("dragleave", (event) => {
		if (!(event.relatedTarget instanceof Node) || !cardEl.contains(event.relatedTarget)) {
			clearCardDropClasses(cardEl);
		}
	});
	cardEl.addEventListener("drop", (event) => {
		void handleCardDrop(event, cardEl, plugin, projects, project, columnStatus);
	});

	const headerEl = cardEl.createDiv({cls: "spv-project-summary-header"});
	createProjectTitleButton(headerEl, project, () => {
		void plugin.app.workspace.getLeaf(false).openFile(project.file);
	}, {
		showIcon: options.showTitleIcon,
	});

	if (options.fields.length > 0) {
		const editButtonEl = headerEl.createEl("button", {
			cls: "clickable-icon spv-board-card-edit",
			attr: {"aria-label": `${isEditing ? "Finish editing" : "Edit"} ${project.title}`},
		});
		setIcon(editButtonEl, isEditing ? "check" : "pencil");
		editButtonEl.addEventListener("click", () => {
			if (isEditing) {
				editingBoardCards.delete(project.file.path);
			} else {
				editingBoardCards.add(project.file.path);
			}

			plugin.refreshProjectSurfaces();
		});
	}

	const afterUpdate = () => {
		plugin.refreshProjectSurfaces();
	};

	if (isEditing && options.fields.length > 0) {
		const fieldsContainerEl = cardEl.createDiv({cls: "spv-board-card-fields-container"});
		renderProjectControls(fieldsContainerEl, plugin.app, plugin.settings, project, {
			controlClass: "spv-board-card-fields",
			fields: options.fields,
			labels: options.labels,
			afterUpdate,
		});
		return;
	}

	const readOnlyFields = getVisibleCardFields(project, options.fields);
	if (readOnlyFields.length === 0) {
		return;
	}

	const fieldsContainerEl = cardEl.createDiv({cls: "spv-board-card-fields-container"});
	renderProjectControls(fieldsContainerEl, plugin.app, plugin.settings, project, {
		controlClass: "spv-board-card-readonly-fields",
		fields: readOnlyFields,
		labels: options.labels,
		readOnly: true,
	});
}

function isCardDragSuppressed(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	return target.closest("input, select, textarea, button, .spv-project-controls, .spv-board-card-edit") !== null;
}

function handleColumnDragOver(event: DragEvent, boardEl: HTMLElement, columnEl: HTMLElement): void {
	if (!event.dataTransfer) {
		return;
	}

	if (hasDragType(event, COLUMN_DRAG_TYPE)) {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
		clearDropClasses(boardEl);
		columnEl.addClass(`spv-board-column-reorder-${getReorderPlacement(event, columnEl)}`);
		return;
	}

	if (hasDragType(event, PROJECT_DRAG_TYPE)) {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
		clearDropClasses(boardEl);
		columnEl.addClass("spv-board-column-drop-target");
	}
}

function handleCardDragOver(event: DragEvent, cardEl: HTMLElement): void {
	if (!event.dataTransfer || !hasDragType(event, PROJECT_DRAG_TYPE)) {
		return;
	}

	event.preventDefault();
	event.stopPropagation();
	event.dataTransfer.dropEffect = "move";
	const boardEl = cardEl.closest(".spv-board");
	if (boardEl instanceof HTMLElement) {
		clearDropClasses(boardEl);
	}

	const sourcePath = event.dataTransfer.getData(PROJECT_DRAG_TYPE);
	if (sourcePath === cardEl.getAttribute("data-spv-project-path")) {
		return;
	}

	cardEl.addClass(`spv-board-card-reorder-${getCardReorderPlacement(event, cardEl)}`);
}

function setBoardCardDragActive(cardEl: HTMLElement, active: boolean): void {
	const boardEl = cardEl.closest(".spv-board");
	if (!(boardEl instanceof HTMLElement)) {
		return;
	}

	boardEl.classList.toggle("spv-board-card-drag-active", active);
	if (active) {
		boardEl.style.setProperty("--spv-board-card-placeholder-height", `${Math.round(cardEl.getBoundingClientRect().height)}px`);
	} else {
		boardEl.style.removeProperty("--spv-board-card-placeholder-height");
		clearDropClasses(boardEl);
	}
}

async function handleColumnDrop(
	event: DragEvent,
	boardEl: HTMLElement,
	columnEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	projects: ProjectInfo[],
	statuses: string[],
	targetStatus: string,
): Promise<void> {
	if (!event.dataTransfer) {
		return;
	}

	if (hasDragType(event, COLUMN_DRAG_TYPE)) {
		event.preventDefault();
		const sourceStatus = event.dataTransfer.getData(COLUMN_DRAG_TYPE);
		const placement = getReorderPlacement(event, columnEl);
		clearDropClasses(boardEl);
		await reorderColumn(plugin, statuses, sourceStatus, targetStatus, placement);
		return;
	}

	if (!hasDragType(event, PROJECT_DRAG_TYPE)) {
		return;
	}

	event.preventDefault();
	clearDropClasses(boardEl);
	const projectPath = event.dataTransfer.getData(PROJECT_DRAG_TYPE);
	await moveProjectOnBoard(plugin, projects, projectPath, {status: targetStatus});
}

async function handleCardDrop(
	event: DragEvent,
	cardEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	projects: ProjectInfo[],
	targetProject: ProjectInfo,
	targetStatus: string,
): Promise<void> {
	if (!event.dataTransfer || !hasDragType(event, PROJECT_DRAG_TYPE)) {
		return;
	}

	event.preventDefault();
	event.stopPropagation();
	const boardEl = cardEl.closest(".spv-board");
	if (boardEl instanceof HTMLElement) {
		clearDropClasses(boardEl);
	} else {
		clearCardDropClasses(cardEl);
	}

	const projectPath = event.dataTransfer.getData(PROJECT_DRAG_TYPE);
	await moveProjectOnBoard(plugin, projects, projectPath, {
		path: targetProject.file.path,
		placement: getCardReorderPlacement(event, cardEl),
		status: targetStatus,
	});
}

async function moveProjectOnBoard(
	plugin: SimpleProjectViewsPlugin,
	projects: ProjectInfo[],
	projectPath: string,
	target: ProjectDropTarget,
): Promise<void> {
	if (!projectPath || projectPath === target.path) {
		return;
	}

	const project = projects.find((candidate) => candidate.file.path === projectPath);
	if (!project) {
		return;
	}

	const nextOrder = reorderProjectPaths(projects, plugin.settings.boardCardOrder, projectPath, target, plugin.settings.statusOptions);
	const statusChanged = getBoardStatus(project.status, plugin.settings.statusOptions) !== target.status;
	const orderChanged = !arraysEqual(plugin.settings.boardCardOrder, nextOrder);

	if (!statusChanged && !orderChanged) {
		return;
	}

	try {
		if (statusChanged) {
			await updateProjectProperty(plugin.app, project.file, plugin.settings.propertyNames.status, target.status);
		}

		if (orderChanged) {
			plugin.settings.boardCardOrder = nextOrder;
			await plugin.saveSettings();
			return;
		}

		plugin.refreshProjectSurfaces();
	} catch (error) {
		console.error("Simple project views: could not move project", error);
		new Notice("Could not move project");
	}
}

async function reorderColumn(
	plugin: SimpleProjectViewsPlugin,
	statuses: string[],
	sourceStatus: string,
	targetStatus: string,
	placement: ReorderPlacement,
): Promise<void> {
	if (sourceStatus === targetStatus) {
		return;
	}

	const nextStatuses = reorderStatuses(statuses, sourceStatus, targetStatus, placement);
	if (arraysEqual(statuses, nextStatuses)) {
		return;
	}

	plugin.settings.boardColumnOrder = nextStatuses;
	await plugin.saveSettings();
}

async function setColumnCollapsed(plugin: SimpleProjectViewsPlugin, status: string, collapsed: boolean): Promise<void> {
	const collapsedStatuses = new Set(plugin.settings.collapsedBoardColumns);
	if (collapsed) {
		collapsedStatuses.add(status);
	} else {
		collapsedStatuses.delete(status);
	}

	plugin.settings.collapsedBoardColumns = Array.from(collapsedStatuses);
	await plugin.saveSettings();
}

function getBoardStatuses(statusOptions: string[], projects: ProjectInfo[], savedOrder: string[]): string[] {
	const defaultStatuses = unique([...statusOptions, ...projects.map((project) => getBoardStatus(project.status, statusOptions))]);
	const savedStatuses = savedOrder.filter((status) => defaultStatuses.includes(status));
	const unsavedStatuses = defaultStatuses.filter((status) => !savedStatuses.includes(status));

	return [...savedStatuses, ...unsavedStatuses];
}

function getBoardStatus(status: string, statusOptions: string[]): string {
	return status && statusOptions.includes(status) ? status : "";
}

function getOrderedBoardProjects(projects: ProjectInfo[], savedOrder: string[]): ProjectInfo[] {
	const projectsByPath = new Map(projects.map((project) => [project.file.path, project]));
	const orderedProjects = savedOrder
		.map((path) => projectsByPath.get(path))
		.filter((project): project is ProjectInfo => project !== undefined);
	const orderedPaths = new Set(orderedProjects.map((project) => project.file.path));
	const unsavedProjects = projects
		.filter((project) => !orderedPaths.has(project.file.path))
		.sort(compareBoardProjects);

	return [...orderedProjects, ...unsavedProjects];
}

function getVisibleCardFields(project: ProjectInfo, fields: ProjectControlField[]): ProjectControlField[] {
	const nonEmptyFields = new Set(getNonEmptyProjectPropertyFieldIds(project));

	return fields.filter((field) => field !== "icon" && field !== "status" && nonEmptyFields.has(field));
}

function compareBoardProjects(a: ProjectInfo, b: ProjectInfo): number {
	return a.title.localeCompare(b.title) || a.file.path.localeCompare(b.file.path);
}

function reorderProjectPaths(
	projects: ProjectInfo[],
	savedOrder: string[],
	sourcePath: string,
	target: ProjectDropTarget,
	statusOptions: string[],
): string[] {
	const orderedPaths = getOrderedBoardProjects(projects, savedOrder).map((project) => project.file.path);
	if (!orderedPaths.includes(sourcePath)) {
		return orderedPaths;
	}

	const nextPaths = orderedPaths.filter((path) => path !== sourcePath);
	if (target.path) {
		const targetIndex = nextPaths.indexOf(target.path);
		if (targetIndex === -1) {
			return orderedPaths;
		}

		nextPaths.splice(target.placement === "after" ? targetIndex + 1 : targetIndex, 0, sourcePath);
		return nextPaths;
	}

	const statusesByPath = new Map(projects.map((project) => [project.file.path, getBoardStatus(project.status, statusOptions)]));
	let lastTargetIndex = -1;
	for (let index = 0; index < nextPaths.length; index += 1) {
		const path = nextPaths[index];
		if (path !== undefined && statusesByPath.get(path) === target.status) {
			lastTargetIndex = index;
		}
	}

	nextPaths.splice(lastTargetIndex + 1, 0, sourcePath);
	return nextPaths;
}

function reorderStatuses(
	statuses: string[],
	sourceStatus: string,
	targetStatus: string,
	placement: ReorderPlacement,
): string[] {
	const nextStatuses = statuses.filter((status) => status !== sourceStatus);
	const targetIndex = nextStatuses.indexOf(targetStatus);
	if (targetIndex === -1) {
		return statuses;
	}

	nextStatuses.splice(placement === "before" ? targetIndex : targetIndex + 1, 0, sourceStatus);
	return nextStatuses;
}

function getReorderPlacement(event: DragEvent, columnEl: HTMLElement): ReorderPlacement {
	const boardEl = columnEl.parentElement;
	const rect = columnEl.getBoundingClientRect();
	const isVertical = boardEl ? getComputedStyle(boardEl).flexDirection === "column" : false;
	const midpoint = isVertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
	const pointerPosition = isVertical ? event.clientY : event.clientX;

	return pointerPosition < midpoint ? "before" : "after";
}

function getCardReorderPlacement(event: DragEvent, cardEl: HTMLElement): ReorderPlacement {
	const rect = cardEl.getBoundingClientRect();
	const midpoint = rect.top + rect.height / 2;

	return event.clientY < midpoint ? "before" : "after";
}

function hasDragType(event: DragEvent, type: string): boolean {
	return Array.from(event.dataTransfer?.types ?? []).includes(type);
}

function clearDropClasses(boardEl: HTMLElement): void {
	const columnEls = boardEl.querySelectorAll(".spv-board-column");
	for (let index = 0; index < columnEls.length; index += 1) {
		const columnEl = columnEls.item(index);
		columnEl.classList.remove("spv-board-column-drop-target");
		columnEl.classList.remove("spv-board-column-reorder-before");
		columnEl.classList.remove("spv-board-column-reorder-after");
	}

	const cardEls = boardEl.querySelectorAll(".spv-board-card");
	for (let index = 0; index < cardEls.length; index += 1) {
		clearCardDropClasses(cardEls.item(index));
	}
}

function clearCardDropClasses(cardEl: Element): void {
	cardEl.classList.remove("spv-board-card-reorder-before");
	cardEl.classList.remove("spv-board-card-reorder-after");
}

function unique(values: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const value of values) {
		if (!seen.has(value)) {
			seen.add(value);
			result.push(value);
		}
	}

	return result;
}

function arraysEqual(first: string[], second: string[]): boolean {
	return first.length === second.length && first.every((value, index) => value === second[index]);
}
