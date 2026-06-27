import {Menu, Notice} from "obsidian";
import type {TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {updateProjectProperty} from "../project-metadata";
import {getProjectPropertyById, isProjectPropertyEmpty} from "../project-properties";

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

function addNativeNoteActionsItem(
	menu: Menu,
	plugin: SimpleProjectViewsPlugin,
	file: TFile,
	sourcePath: string,
): void {
	menu.addSeparator();
	menu.addItem((item) => {
		item
			.setTitle("Note actions")
			.setIcon("more-horizontal")
			.setIsLabel(true);
	});

	const leaf = plugin.app.workspace.getMostRecentLeaf();
	const handled = plugin.app.workspace.handleLinkContextMenu(menu, file.path, sourcePath, leaf ?? undefined);
	if (!handled) {
		menu.addItem((item) => {
			item
				.setTitle("No note actions available")
				.setDisabled(true);
		});
	}
}

async function updateProjectLinkProperty(
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
	propertyName: string,
	value: string | number | null,
): Promise<void> {
	try {
		await updateProjectProperty(plugin.app, project.file, propertyName, value);
		plugin.refreshProjectSurfaces();
	} catch (error) {
		console.error("Simple project views: could not update pretty link project property", error);
		new Notice("Could not update project property");
	}
}
