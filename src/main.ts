import {MarkdownView, Notice, normalizePath, Plugin, TFile} from "obsidian";
import {buildProjectBaseContent} from "./bases/base-file";
import {ProjectBasesView} from "./bases/project-bases-view";
import {
	PROJECT_BOARD_BASES_VIEW_TYPE,
	PROJECT_LIST_BASES_VIEW_TYPE,
	PROJECT_TABLE_BASES_VIEW_TYPE,
} from "./constants";
import {appendProjectPropertyListItem, ProjectIndex, repairProjectFrontmatter, updateProjectProperty} from "./project-metadata";
import {createProjectFileLink} from "./project-relationships";
import {buildProjectContent, buildProjectPath} from "./project-template";
import type {ProjectCreationValues} from "./project-template";
import {DEFAULT_PROJECT_CREATION_TEMPLATE, DEFAULT_SETTINGS, normalizeSettings, SimpleProjectViewsSettingTab} from "./settings";
import type {SimpleProjectViewsSettings} from "./settings";
import {CreateProjectModal} from "./ui/create-project-modal";
import {
	createPrettyProjectLinkLivePreviewExtension,
	refreshPrettyProjectLinkLivePreviewEditors,
} from "./ui/pretty-project-link-live-preview";
import {refreshPrettyProjectLinksInReadingView, registerPrettyProjectLinks} from "./ui/pretty-project-links";
import {ProjectNoteToolbar} from "./ui/project-note-toolbar";

export default class SimpleProjectViewsPlugin extends Plugin {
	settings: SimpleProjectViewsSettings;
	projectIndex: ProjectIndex;
	private projectToolbar: ProjectNoteToolbar | null = null;
	private readonly projectBasesViews = new Set<ProjectBasesView>();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.projectIndex = new ProjectIndex(this.app, () => this.settings);
		this.projectToolbar = new ProjectNoteToolbar(this);
		this.registerEditorExtension(createPrettyProjectLinkLivePreviewExtension(this));

		this.registerProjectBasesViews();
		this.registerCommands();
		this.registerProjectRefreshEvents();
		registerPrettyProjectLinks(this);

		this.addSettingTab(new SimpleProjectViewsSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this.refreshProjectSurfaces());
	}

	onunload(): void {
		this.projectToolbar?.removeAll();
	}

	async loadSettings(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData() as Partial<SimpleProjectViewsSettings>);
	}

	async saveSettings(): Promise<void> {
		this.settings = normalizeSettings(this.settings);
		await this.saveData(this.settings);
		this.refreshProjectSurfaces();
	}

	refreshProjectSurfaces(): void {
		this.projectToolbar?.refreshAll();
		this.refreshProjectBasesViews();
		refreshPrettyProjectLinksInReadingView(this);
		refreshPrettyProjectLinkLivePreviewEditors();
		this.app.workspace.updateOptions();
	}

	openCreateChildProjectModal(parentFile: TFile): void {
		if (!this.settings.relationshipsEnabled) {
			new Notice("Project relationships are disabled");
			return;
		}

		if (!this.projectIndex.getProject(parentFile)) {
			new Notice("Open a project note to create a child project");
			return;
		}

		new CreateProjectModal(this, {
			title: "Create child project",
			submitLabel: "Create child",
			errorMessage: "Could not create child project",
			createProject: (values) => this.createChildProject(parentFile, values),
		}).open();
	}

	registerProjectBasesView(view: ProjectBasesView): void {
		this.projectBasesViews.add(view);
	}

	unregisterProjectBasesView(view: ProjectBasesView): void {
		this.projectBasesViews.delete(view);
	}

	private registerProjectBasesViews(): void {
		this.registerBasesView(PROJECT_LIST_BASES_VIEW_TYPE, {
			name: "Project list",
			icon: "lucide-list-checks",
			factory: (controller, containerEl) => new ProjectBasesView(controller, containerEl, this, PROJECT_LIST_BASES_VIEW_TYPE, "list"),
		});

		this.registerBasesView(PROJECT_BOARD_BASES_VIEW_TYPE, {
			name: "Project board",
			icon: "lucide-kanban",
			factory: (controller, containerEl) => new ProjectBasesView(controller, containerEl, this, PROJECT_BOARD_BASES_VIEW_TYPE, "board"),
		});

		this.registerBasesView(PROJECT_TABLE_BASES_VIEW_TYPE, {
			name: "Project table",
			icon: "lucide-table-2",
			factory: (controller, containerEl) => new ProjectBasesView(controller, containerEl, this, PROJECT_TABLE_BASES_VIEW_TYPE, "table"),
		});
	}

	private registerCommands(): void {
		this.addCommand({
			id: "create-project",
			name: "Create project",
			callback: () => {
				new CreateProjectModal(this).open();
			},
		});

		this.addCommand({
			id: "create-child-project",
			name: "Create child project",
			checkCallback: (checking) => {
				if (!this.settings.relationshipsEnabled) {
					return false;
				}

				const parentFile = this.getActiveMarkdownFile();
				if (!parentFile || !this.projectIndex.getProject(parentFile)) {
					return false;
				}

				if (!checking) {
					this.openCreateChildProjectModal(parentFile);
				}

				return true;
			},
		});

		this.addCommand({
			id: "create-project-base",
			name: "Create project base",
			callback: () => {
				void this.createProjectBase();
			},
		});

		this.addCommand({
			id: "refresh-project-views",
			name: "Refresh project views",
			callback: () => this.refreshProjectSurfaces(),
		});

		this.addCommand({
			id: "repair-current-note-project-properties",
			name: "Repair current note project properties",
			checkCallback: (checking) => {
				const file = this.getActiveMarkdownFile();
				if (!file) {
					return false;
				}

				if (!checking) {
					void repairProjectFrontmatter(this.app, file)
						.then((changed) => {
							new Notice(changed ? "Project properties repaired" : "No duplicate project properties found");
							this.refreshProjectSurfaces();
						});
				}

				return true;
			},
		});
	}

	async createProject(values: ProjectCreationValues, options: {showNotice?: boolean} = {}): Promise<TFile> {
		const configuredPath = buildProjectPath(this.settings, values);
		const path = this.getAvailableMarkdownPath(normalizePath(configuredPath));
		const template = await this.readProjectCreationTemplate();
		await this.ensureParentFolder(path);
		const file = await this.app.vault.create(path, buildProjectContent(this.settings, values, template));
		await this.app.workspace.getLeaf(false).openFile(file);
		if (options.showNotice !== false) {
			new Notice("Project created");
		}
		this.refreshProjectSurfaces();

		return file;
	}

	async createChildProject(parentFile: TFile, values: ProjectCreationValues): Promise<TFile> {
		const childFile = await this.createProject(values, {showNotice: false});
		const parentPropertyName = this.settings.relationshipPropertyNames.parent.trim();
		const childrenPropertyName = this.settings.relationshipPropertyNames.children.trim();
		const parentLink = createProjectFileLink(this.app, childFile, parentFile);
		const childLink = createProjectFileLink(this.app, parentFile, childFile);

		if (parentPropertyName) {
			await updateProjectProperty(this.app, childFile, parentPropertyName, parentLink);
		}

		if (childrenPropertyName) {
			await appendProjectPropertyListItem(this.app, parentFile, childrenPropertyName, childLink);
		}

		new Notice("Child project created");
		this.refreshProjectSurfaces();

		return childFile;
	}

	private async readProjectCreationTemplate(): Promise<string> {
		const configuredPath = this.settings.projectCreationTemplatePath.trim();
		if (!configuredPath) {
			return DEFAULT_PROJECT_CREATION_TEMPLATE;
		}

		const templatePath = normalizePath(configuredPath);
		const file = this.app.vault.getAbstractFileByPath(templatePath);
		if (!(file instanceof TFile)) {
			new Notice("Project template file not found; using default template");
			return DEFAULT_PROJECT_CREATION_TEMPLATE;
		}

		return this.app.vault.read(file);
	}

	private registerProjectRefreshEvents(): void {
		this.registerEvent(this.app.workspace.on("file-open", () => this.refreshProjectSurfaces()));
		this.registerEvent(this.app.workspace.on("layout-change", () => this.refreshProjectSurfaces()));
		this.registerEvent(this.app.metadataCache.on("changed", () => this.refreshProjectSurfaces()));
		this.registerEvent(this.app.vault.on("delete", () => this.refreshProjectSurfaces()));
		this.registerEvent(this.app.vault.on("rename", () => this.refreshProjectSurfaces()));
	}

	private refreshProjectBasesViews(): void {
		for (const view of this.projectBasesViews) {
			view.render();
		}
	}

	private getActiveMarkdownFile(): TFile | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		return view?.file ?? null;
	}

	private async createProjectBase(): Promise<void> {
		const configuredPath = this.settings.baseFilePath.trim() || DEFAULT_SETTINGS.baseFilePath;
		const path = normalizePath(configuredPath.endsWith(".base") ? configuredPath : `${configuredPath}.base`);
		const existingFile = this.app.vault.getAbstractFileByPath(path);

		if (existingFile instanceof TFile) {
			await this.app.workspace.getLeaf(false).openFile(existingFile);
			new Notice("Project base already exists");
			return;
		}

		await this.ensureParentFolder(path);
		const file = await this.app.vault.create(path, buildProjectBaseContent(this.settings));
		await this.app.workspace.getLeaf(false).openFile(file);
		new Notice("Project base created");
	}

	private getAvailableMarkdownPath(path: string): string {
		if (!this.app.vault.getAbstractFileByPath(path)) {
			return path;
		}

		const extension = ".md";
		const basePath = path.endsWith(extension) ? path.slice(0, -extension.length) : path;
		for (let index = 2; index < 1000; index += 1) {
			const candidate = `${basePath} ${index}${extension}`;
			if (!this.app.vault.getAbstractFileByPath(candidate)) {
				return candidate;
			}
		}

		return `${basePath} ${Date.now()}${extension}`;
	}

	private async ensureParentFolder(path: string): Promise<void> {
		const lastSlashIndex = path.lastIndexOf("/");
		if (lastSlashIndex === -1) {
			return;
		}

		const folderPath = path.slice(0, lastSlashIndex);
		if (this.app.vault.getAbstractFileByPath(folderPath)) {
			return;
		}

		const parts = folderPath.split("/");
		let currentPath = "";
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(currentPath)) {
				await this.app.vault.createFolder(currentPath);
			}
		}
	}
}
