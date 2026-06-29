import {MarkdownView} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import {renderProjectControls} from "./project-controls";
import {renderProjectRelationships} from "./project-relationship-controls";

const TOOLBAR_CLASS = "spv-project-note-toolbar";

export class ProjectNoteToolbar {
	constructor(private readonly plugin: SimpleProjectViewsPlugin) {
	}

	refreshAll(): void {
		this.removeAll();

		if (!this.plugin.settings.showProjectToolbar) {
			return;
		}

		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				this.decorateView(leaf.view);
			}
		});
	}

	removeAll(): void {
		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				leaf.view.containerEl.querySelectorAll(`.${TOOLBAR_CLASS}`).forEach((toolbarEl) => toolbarEl.remove());
			}
		});
	}

	private decorateView(view: MarkdownView): void {
		const file = view.file;
		if (!file) {
			return;
		}

		const project = this.plugin.projectIndex.getProject(file);
		if (!project) {
			return;
		}

		const position = this.plugin.settings.noteToolbarPosition;
		const targetEl = this.getToolbarTarget(view);
		const toolbarEl = targetEl.createDiv({
			cls: `${TOOLBAR_CLASS} ${TOOLBAR_CLASS}-${position}`,
		});
		if (position === "bottom") {
			targetEl.append(toolbarEl);
		} else {
			targetEl.prepend(toolbarEl);
		}

		renderProjectControls(toolbarEl, this.plugin.app, this.plugin.settings, project, {
			controlClass: "spv-note-bar-controls",
			afterUpdate: () => this.plugin.refreshProjectSurfaces(),
		});
		renderProjectRelationships(toolbarEl, this.plugin, project);
	}

	private getToolbarTarget(view: MarkdownView): HTMLElement {
		if (view.getMode() === "preview") {
			return view.previewMode.containerEl.querySelector<HTMLElement>(".markdown-preview-sizer")
				?? view.previewMode.containerEl;
		}

		return view.contentEl;
	}
}
