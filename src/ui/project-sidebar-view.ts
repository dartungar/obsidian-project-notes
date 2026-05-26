import {ItemView, Notice, setIcon, WorkspaceLeaf} from "obsidian";
import {PROJECTS_VIEW_TYPE} from "../constants";
import type SimpleProjectViewsPlugin from "../main";
import type {ProjectInfo} from "../project-metadata";
import {getStatusColor} from "../settings";
import {getNonEmptyProjectPropertyFieldIds, renderProjectControls} from "./project-controls";
import {createProjectTitleButton} from "./project-icon";

export class ProjectSidebarView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: SimpleProjectViewsPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return PROJECTS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Current projects";
	}

	getIcon(): string {
		return "list-checks";
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	render(): void {
		const containerEl = this.containerEl.children[1];
		if (!(containerEl instanceof HTMLElement)) {
			return;
		}

		containerEl.empty();
		containerEl.addClass("spv-sidebar");

		const headerEl = containerEl.createDiv({cls: "spv-sidebar-header"});
		const titleEl = headerEl.createDiv({cls: "spv-sidebar-title"});
		titleEl.createEl("h2", {text: "Current projects"});

		const refreshButtonEl = headerEl.createEl("button", {
			cls: "clickable-icon spv-sidebar-refresh",
			attr: {"aria-label": "Refresh projects"},
		});
		setIcon(refreshButtonEl, "refresh-cw");
		refreshButtonEl.addEventListener("click", () => this.plugin.refreshProjectSurfaces());

		const projects = this.plugin.projectIndex.getCurrentProjects();
		titleEl.createSpan({text: `${projects.length} active`});
		if (projects.length === 0) {
			containerEl.createDiv({
				cls: "spv-empty-state",
				text: "No current projects match your settings.",
			});
			return;
		}

		const listEl = containerEl.createDiv({cls: "spv-project-list"});
		for (const project of projects) {
			this.renderProject(listEl, project);
		}
	}

	private renderProject(containerEl: HTMLElement, project: ProjectInfo): void {
		const cardEl = containerEl.createDiv({cls: "spv-project-card"});
		const headerEl = cardEl.createDiv({cls: "spv-project-card-header"});
		createProjectTitleButton(headerEl, project, () => {
			void this.app.workspace.getLeaf(false).openFile(project.file);
		});
		const statusEl = headerEl.createSpan({
			cls: "spv-status-badge",
			text: project.status || "No status",
		});
		statusEl.style.setProperty("--spv-status-color", getStatusColor(this.plugin.settings, project.status));

		renderProjectControls(cardEl, this.plugin.app, this.plugin.settings, project, {
			controlClass: "spv-sidebar-readonly-controls",
			fields: getNonEmptyProjectPropertyFieldIds(project),
			readOnly: true,
		});

		if (project.warnings.length > 0) {
			const warningsEl = cardEl.createDiv({cls: "spv-project-warnings"});
			for (const warning of project.warnings) {
				warningsEl.createSpan({text: warning});
			}
		}

		renderProjectControls(cardEl, this.plugin.app, this.plugin.settings, project, {
			compact: true,
			afterUpdate: () => {
				this.plugin.refreshProjectSurfaces();
				new Notice("Project updated");
			},
		});
	}
}
