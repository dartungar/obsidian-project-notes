import {Menu, Notice} from "obsidian";
import type {EventRef, TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {updateProjectProperty} from "../project-metadata";
import {getProjectPropertyById, isProjectPropertyEmpty} from "../project-properties";

interface NativeNoteActionsItemOptions {
	createTitle?: (openMenu: (event: MouseEvent | KeyboardEvent) => void) => string | DocumentFragment;
}

interface ProjectMetadataRefreshWaitOptions {
	maxPollAttempts?: number;
	pollDelayMs?: number;
}

const DEFAULT_METADATA_REFRESH_MAX_POLL_ATTEMPTS = 40;
const DEFAULT_METADATA_REFRESH_POLL_DELAY_MS = 50;

export function showProjectLinkMenu(
	event: MouseEvent,
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
	sourcePath: string,
): void {
	event.preventDefault();
	event.stopPropagation();

	const menu = Menu.forEvent(event);
	menu.addItem((item) => {
		item
			.setTitle("Open note")
			.setIcon("file-text")
			.onClick(() => {
				void plugin.app.workspace.getLeaf(false).openFile(project.file);
			});
	});

	addStatusItems(menu, plugin, project);
	addPropertyItems(menu, plugin, project);
	addNativeNoteActionsItem(menu, plugin, project.file, sourcePath);
	menu.showAtMouseEvent(event);
}

function addStatusItems(
	menu: Menu,
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
): void {
	if (plugin.settings.statusOptions.length === 0 || !plugin.settings.propertyNames.status.trim()) {
		return;
	}

	menu.addSeparator();
	for (const status of plugin.settings.statusOptions) {
		menu.addItem((item) => {
			item
				.setTitle(status || "No status")
				.setIcon("circle")
				.setChecked(project.status === status)
				.onClick(() => {
					void updateProjectLinkProperty(plugin, project, plugin.settings.propertyNames.status, status || null);
				});
		});
	}
}

function addPropertyItems(
	menu: Menu,
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
): void {
	const editableProperties = plugin.settings.projectProperties.filter((property) => property.name.trim().length > 0);
	if (editableProperties.length === 0) {
		return;
	}

	menu.addSeparator();
	for (const definition of editableProperties) {
		const property = getProjectPropertyById(project.properties, definition.id);
		menu.addItem((item) => {
			item
				.setTitle(`Clear ${definition.label || definition.name}`)
				.setIcon("eraser")
				.setDisabled(!property || isProjectPropertyEmpty(property))
				.onClick(() => {
					void updateProjectLinkProperty(plugin, project, definition.name, null);
				});
		});
	}
}

export function addNativeNoteActionsItem(
	menu: Menu,
	plugin: SimpleProjectViewsPlugin,
	file: TFile,
	sourcePath: string,
	options: NativeNoteActionsItemOptions = {},
): void {
	menu.addSeparator();
	let openMenuRef: Menu | null = null;
	const openMenu = (event: MouseEvent | KeyboardEvent): void => {
		event.preventDefault();
		event.stopPropagation();
		openMenuRef?.hide();
		openMenuRef = openNativeNoteActionsMenu(event, plugin, file, sourcePath);
		openMenuRef.onHide(() => {
			openMenuRef = null;
		});
	};
	const title = options.createTitle?.(openMenu) ?? createNoteActionsMenuTitle(openMenu);

	menu.addItem((item) => {
		item
			.setTitle(title)
			.setIcon("more-horizontal")
			.onClick(openMenu);
	});
}

export function createNoteActionsMenuTitle(
	openMenu: (event: MouseEvent | KeyboardEvent) => void,
	doc: Document = window.activeDocument,
): DocumentFragment {
	const fragment = doc.createDocumentFragment();
	const titleEl = doc.createElement("span");
	titleEl.className = "spv-note-actions-submenu-title";
	titleEl.addEventListener("mouseenter", openMenu);

	const labelEl = doc.createElement("span");
	labelEl.textContent = "Note actions";
	titleEl.append(labelEl);

	const arrowEl = doc.createElement("span");
	arrowEl.className = "spv-note-actions-submenu-arrow";
	arrowEl.setAttribute("aria-hidden", "true");
	arrowEl.textContent = "›";
	titleEl.append(arrowEl);

	fragment.append(titleEl);
	return fragment;
}

export function populateNativeNoteActionsMenu(
	menu: Menu,
	plugin: SimpleProjectViewsPlugin,
	file: TFile,
	sourcePath: string,
): boolean {
	const leaf = plugin.app.workspace.getMostRecentLeaf();
	const handled = plugin.app.workspace.handleLinkContextMenu(menu, file.path, sourcePath, leaf ?? undefined);
	if (!handled) {
		menu.addItem((item) => {
			item
				.setTitle("No note actions available")
				.setDisabled(true);
		});
	}

	return handled;
}

function openNativeNoteActionsMenu(
	event: MouseEvent | KeyboardEvent,
	plugin: SimpleProjectViewsPlugin,
	file: TFile,
	sourcePath: string,
): Menu {
	const menu = new Menu();
	populateNativeNoteActionsMenu(menu, plugin, file, sourcePath);
	showMenuAtEvent(menu, event);
	return menu;
}

function showMenuAtEvent(menu: Menu, event: MouseEvent | KeyboardEvent): void {
	const target = event.currentTarget;
	if (target instanceof HTMLElement) {
		const rect = target.getBoundingClientRect();
		menu.showAtPosition({
			x: rect.right,
			y: rect.top,
			overlap: true,
		});
		return;
	}

	if ("clientX" in event && "clientY" in event) {
		menu.showAtPosition({
			x: event.clientX,
			y: event.clientY,
			overlap: true,
		});
		return;
	}

	menu.showAtPosition({x: 0, y: 0});
}

async function updateProjectLinkProperty(
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
	propertyName: string,
	value: string | number | null,
): Promise<void> {
	try {
		await updateProjectProperty(plugin.app, project.file, propertyName, value);
		waitForProjectMetadataRefreshAfterProjectLinkPropertyUpdate(plugin, project.file, propertyName, value);
	} catch (error) {
		console.error("Simple project views: could not update pretty link project property", error);
		new Notice("Could not update project property");
	}
}

export function waitForProjectMetadataRefreshAfterProjectLinkPropertyUpdate(
	plugin: SimpleProjectViewsPlugin,
	file: TFile,
	propertyName?: string,
	value?: string | number | null,
	options: ProjectMetadataRefreshWaitOptions = {},
): () => void {
	const metadataCache = plugin.app.metadataCache;
	let isListening = true;
	let isCancelled = false;
	let hasTargetMetadataChanged = false;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let pollAttempts = 0;
	const eventRefs: EventRef[] = [];
	const maxPollAttempts = options.maxPollAttempts ?? DEFAULT_METADATA_REFRESH_MAX_POLL_ATTEMPTS;
	const pollDelayMs = options.pollDelayMs ?? DEFAULT_METADATA_REFRESH_POLL_DELAY_MS;
	const stopListening = () => {
		if (!isListening) {
			return;
		}

		isListening = false;
		for (const eventRef of eventRefs) {
			metadataCache.offref(eventRef);
		}
	};
	const clearPendingPoll = () => {
		if (timeoutId === null) {
			return;
		}

		clearTimeout(timeoutId);
		timeoutId = null;
	};
	const refreshAfterMetadataResolved = () => {
		stopListening();
		clearPendingPoll();
		if (!isCancelled) {
			plugin.refreshProjectSurfaces();
		}
	};
	const isWaitingForPropertyValue = propertyName !== undefined;
	const shouldRefresh = () => {
		return !isWaitingForPropertyValue || isProjectPropertyValueVisible(plugin, file, propertyName, value ?? null);
	};
	const checkOrScheduleRefresh = () => {
		if (isCancelled) {
			return;
		}

		if (shouldRefresh() || pollAttempts >= maxPollAttempts) {
			refreshAfterMetadataResolved();
			return;
		}

		if (timeoutId !== null) {
			return;
		}

		pollAttempts += 1;
		timeoutId = setTimeout(() => {
			timeoutId = null;
			checkOrScheduleRefresh();
		}, pollDelayMs);
	};

	eventRefs.push(metadataCache.on("changed", (changedFile) => {
		if (isCancelled || changedFile.path !== file.path) {
			return;
		}

		hasTargetMetadataChanged = true;
		if (isWaitingForPropertyValue) {
			checkOrScheduleRefresh();
		}
	}));
	eventRefs.push(metadataCache.on("resolved", () => {
		if (!hasTargetMetadataChanged) {
			return;
		}

		checkOrScheduleRefresh();
	}));
	for (const eventRef of eventRefs) {
		plugin.registerEvent(eventRef);
	}

	if (isWaitingForPropertyValue) {
		checkOrScheduleRefresh();
	}

	return () => {
		isCancelled = true;
		stopListening();
		clearPendingPoll();
	};
}

function isProjectPropertyValueVisible(
	plugin: SimpleProjectViewsPlugin,
	file: TFile,
	propertyName: string | undefined,
	value: string | number | null,
): boolean {
	if (!propertyName) {
		return true;
	}

	const project = plugin.projectIndex.getProject(file);
	if (!project) {
		return false;
	}

	const expectedValue = value === null ? "" : String(value);
	if (propertyName === plugin.settings.propertyNames.status) {
		return project.status === expectedValue;
	}

	const property = project.properties.find((candidate) => candidate.definition.name === propertyName);
	if (value === null || value === "") {
		return !property || isProjectPropertyEmpty(property);
	}

	return property !== undefined && String(property.value || property.numberValue || "") === expectedValue;
}
