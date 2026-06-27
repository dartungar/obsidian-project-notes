import {parseLinktext, setIcon} from "obsidian";
import type {TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {renderProjectControls} from "./project-controls";
import {getPrettyLinkVisibleFields} from "./pretty-project-link-fields";
import {showProjectLinkMenu} from "./project-link-menu";

export interface PrettyProjectLinkData {
	project: ProjectInfo;
	file: TFile;
	sourcePath: string;
	linktext: string;
	label: string;
}

export function resolvePrettyProjectLink(
	plugin: SimpleProjectViewsPlugin,
	linktext: string,
	sourcePath: string,
	label = "",
): PrettyProjectLinkData | null {
	if (!plugin.settings.prettyLinksEnabled) {
		return null;
	}

	const parsed = parseLinktext(linktext);
	if (parsed.subpath) {
		return null;
	}

	const file = plugin.app.metadataCache.getFirstLinkpathDest(parsed.path, sourcePath);
	if (!file) {
		return null;
	}

	const project = plugin.projectIndex.getProject(file);
	if (!project) {
		return null;
	}

	return {
		project,
		file,
		sourcePath,
		linktext,
		label: label.trim() || project.title,
	};
}

export function renderPrettyProjectLink(
	containerEl: HTMLElement,
	plugin: SimpleProjectViewsPlugin,
	data: PrettyProjectLinkData,
): HTMLElement {
	const linkEl = containerEl.createEl("span", {
		cls: "spv-pretty-project-link",
		attr: {
			role: "link",
			tabindex: "0",
			"data-href": data.linktext,
			"data-spv-project-path": data.file.path,
		},
	});

	const titleEl = linkEl.createSpan({cls: "spv-pretty-project-link-title"});
	if (data.project.icon) {
		const iconEl = titleEl.createSpan({
			cls: "spv-project-icon spv-pretty-project-link-icon",
			attr: {"aria-hidden": "true"},
		});
		setIcon(iconEl, data.project.icon);
	}
	titleEl.createSpan({cls: "spv-pretty-project-link-label", text: data.label});

	const fields = getPrettyLinkVisibleFields(plugin.settings, data.project);
	if (fields.length > 0) {
		renderProjectControls(linkEl, plugin.app, plugin.settings, data.project, {
			compact: true,
			controlClass: "spv-pretty-project-link-fields",
			fields,
			readOnly: true,
		});
	}

	linkEl.addEventListener("click", (event) => {
		if (event.defaultPrevented) {
			return;
		}

		event.preventDefault();
		void plugin.app.workspace.getLeaf(event.ctrlKey || event.metaKey).openFile(data.file);
	});
	linkEl.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") {
			return;
		}

		event.preventDefault();
		void plugin.app.workspace.getLeaf(false).openFile(data.file);
	});
	linkEl.addEventListener("contextmenu", (event) => {
		showProjectLinkMenu(event, plugin, data.project, data.sourcePath);
	});

	return linkEl;
}
