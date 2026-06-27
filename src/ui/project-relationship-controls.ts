import {parseLinktext, setIcon} from "obsidian";
import type {TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import type {ProjectRelationshipLink} from "../project-relationships";
import {renderProjectControls} from "./project-controls";

export function renderProjectRelationships(
	containerEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	project: ProjectInfo,
): void {
	if (!plugin.settings.relationshipsEnabled) {
		return;
	}

	const parentFile = resolveRelationshipFile(plugin, project, project.relationships.parent);
	const parentProject = parentFile ? plugin.projectIndex.getProject(parentFile) : null;
	const children = project.relationships.children
		.map((child) => ({
			link: child,
			file: resolveRelationshipFile(plugin, project, child),
		}))
		.filter((child): child is {link: ProjectRelationshipLink; file: TFile} => child.file !== null)
		.map((child) => ({
			...child,
			project: plugin.projectIndex.getProject(child.file),
		}));
	const canCreateChild = plugin.settings.relationshipPropertyNames.parent.trim().length > 0
		&& plugin.settings.relationshipPropertyNames.children.trim().length > 0;

	if (!parentFile && children.length === 0 && !canCreateChild) {
		return;
	}

	const relationshipsEl = containerEl.createDiv({cls: "spv-project-relationships"});

	if (parentFile) {
		const rowEl = relationshipsEl.createDiv({cls: "spv-relationship-row"});
		rowEl.createSpan({cls: "spv-relationship-label", text: "Parent"});
		createRelationshipItem(rowEl, plugin, project.relationships.parent?.display ?? parentFile.basename, parentFile, parentProject);
	}

	if (children.length > 0) {
		const groupEl = relationshipsEl.createDiv({cls: "spv-relationship-group"});
		groupEl.createSpan({cls: "spv-relationship-label", text: "Children"});
		const listEl = groupEl.createEl("ul", {cls: "spv-relationship-list"});
		for (const child of children) {
			const itemEl = listEl.createEl("li");
			createRelationshipItem(itemEl, plugin, child.link.display || child.file.basename, child.file, child.project);
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

function createRelationshipItem(
	containerEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	label: string,
	file: TFile,
	project: ProjectInfo | null,
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

	if (!project || plugin.settings.relationshipDetailFields.length === 0) {
		return;
	}

	renderProjectControls(containerEl, plugin.app, plugin.settings, project, {
		compact: true,
		controlClass: "spv-relationship-details",
		fields: plugin.settings.relationshipDetailFields,
		readOnly: true,
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
