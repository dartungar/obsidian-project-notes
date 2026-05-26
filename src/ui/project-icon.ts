import {setIcon} from "obsidian";
import type {ProjectInfo} from "../project-metadata";

export function createProjectTitleButton(
	containerEl: HTMLElement,
	project: ProjectInfo,
	onClick: () => void,
): HTMLButtonElement {
	const titleEl = containerEl.createEl("button", {
		cls: "spv-link-button spv-project-title-button",
	});
	renderProjectTitle(titleEl, project);
	titleEl.addEventListener("click", onClick);

	return titleEl;
}

export function renderProjectTitle(containerEl: HTMLElement, project: ProjectInfo): void {
	renderProjectIcon(containerEl, project.icon);
	containerEl.createSpan({
		cls: "spv-project-title-text",
		text: project.title,
	});
}

export function renderProjectIcon(containerEl: HTMLElement, icon: string, extraClass = ""): HTMLElement | null {
	if (!icon) {
		return null;
	}

	const iconEl = containerEl.createSpan({
		cls: ["spv-project-icon", extraClass].filter(Boolean).join(" "),
		attr: {"aria-hidden": "true"},
	});
	setIcon(iconEl, icon);

	return iconEl;
}
