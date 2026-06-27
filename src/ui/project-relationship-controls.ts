import {parseLinktext, setIcon} from "obsidian";
import type {TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import type {ProjectRelationshipLink} from "../project-relationships";

export function renderProjectRelationships(
	containerEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
): void {
	const parent = resolveRelationshipFile(plugin, project, project.relationships.parent);
	const children = project.relationships.children
		.map((child) => ({
			link: child,
			file: resolveRelationshipFile(plugin, project, child),
		}))
		.filter((child): child is {link: ProjectRelationshipLink; file: TFile} => child.file !== null);
	const canCreateChild = plugin.settings.relationshipPropertyNames.parent.trim().length > 0
		&& plugin.settings.relationshipPropertyNames.children.trim().length > 0;

	if (!parent && children.length === 0 && !canCreateChild) {
		return;
	}

	const relationshipsEl = containerEl.createDiv({cls: "spv-project-relationships"});

	if (parent) {
		const rowEl = relationshipsEl.createDiv({cls: "spv-relationship-row"});
		rowEl.createSpan({cls: "spv-relationship-label", text: "Parent"});
		createRelationshipButton(rowEl, plugin, project.relationships.parent?.display ?? parent.basename, parent);
	}

	if (children.length > 0) {
		const groupEl = relationshipsEl.createDiv({cls: "spv-relationship-group"});
		groupEl.createSpan({cls: "spv-relationship-label", text: "Children"});
		const listEl = groupEl.createEl("ul", {cls: "spv-relationship-list"});
		for (const child of children) {
			const itemEl = listEl.createEl("li");
			createRelationshipButton(itemEl, plugin, child.link.display || child.file.basename, child.file);
		}
	}

	if (canCreateChild) {
		const buttonEl = relationshipsEl.createEl("button", {
			cls: "spv-create-child-project",
			attr: {
				type: "button",
				"aria-label": "Create child project",
			},
		});
		setIcon(buttonEl, "git-branch-plus");
		buttonEl.createSpan({text: "Create child"});
		buttonEl.addEventListener("click", () => {
			plugin.openCreateChildProjectModal(project.file);
		});
	}
}

function createRelationshipButton(
	containerEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	label: string,
	file: TFile,
): void {
	const buttonEl = containerEl.createEl("button", {
		cls: "spv-link-button spv-relationship-link",
		text: label,
		attr: {
			type: "button",
		},
	});
	buttonEl.addEventListener("click", () => {
		void plugin.app.workspace.getLeaf(false).openFile(file);
	});
}

function resolveRelationshipFile(
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
	link: ProjectRelationshipLink | null,
) {
	if (!link) {
		return null;
	}

	const parsed = parseLinktext(link.target);
	return plugin.app.metadataCache.getFirstLinkpathDest(parsed.path, project.file.path);
}
