import {App, ButtonComponent, Modal, Notice, PluginSettingTab, Setting, SuggestModal, TFile} from "obsidian";
import type SimpleProjectViewsPlugin from "./main";
import {normalizeBoardCardLayout, normalizeColorfulBoard} from "./bases/board-appearance";
import type {BoardCardLayout} from "./bases/board-appearance";
import {normalizeShowTableColumnDividers} from "./bases/table-appearance";
import {updateProjectProperty} from "./project-metadata";
import {
	cloneProjectProperties,
	createProjectPropertyDefinition,
	DEFAULT_PROJECT_PROPERTIES,
	getCompatibleRenderModes,
	getPropertyLabelModeLabel,
	getPropertyLabelModes,
	getPropertyRenderModeLabel,
	getPropertyTypeLabel,
	getPropertyTypes,
	normalizeProjectPropertyDefinitions,
	normalizePropertyLabelMode,
	normalizePropertyRenderMode,
	normalizePropertyType,
} from "./project-properties";
import type {ProjectPropertyDefinition} from "./project-properties";
import {ProjectIconSuggestModal} from "./ui/icon-suggest-modal";

export type ProjectMatchType = "tag" | "property" | "folder";
export type ProjectToolbarPosition = "top" | "bottom" | "left" | "right";
export type StatusDisplayMode = "text" | "colored-text" | "outline" | "colored-outline" | "filled";
type SettingsTabId = "general" | "views" | "noteBar" | "prettyLinks" | "relationships" | "statuses" | "properties";

export interface ProjectPropertyNames {
	icon: string;
	status: string;
	progress: string;
	due: string;
	delegatedTo: string;
	followUp: string;
	nextAction: string;
	blockedReason: string;
}

export interface ProjectRelationshipPropertyNames {
	parent: string;
	children: string;
}

export type ProjectPropertyKey = keyof ProjectPropertyNames;
export type ToggleableProjectPropertyKey = Exclude<ProjectPropertyKey, "status">;

export type ProjectPropertyToggles = Record<ToggleableProjectPropertyKey, boolean>;

export interface SimpleProjectViewsSettings {
	projectMatchType: ProjectMatchType;
	projectTag: string;
	projectPropertyName: string;
	projectPropertyValue: string;
	projectFolder: string;
	propertyNames: ProjectPropertyNames;
	relationshipsEnabled: boolean;
	relationshipPropertyNames: ProjectRelationshipPropertyNames;
	relationshipDetailFields: string[];
	enabledProperties: ProjectPropertyToggles;
	projectProperties: ProjectPropertyDefinition[];
	statusOptions: string[];
	statusColors: Record<string, string>;
	statusDisplay: StatusDisplayMode;
	showProjectToolbar: boolean;
	noteToolbarPosition: ProjectToolbarPosition;
	prettyLinksEnabled: boolean;
	prettyLinkShowPropertyNames: boolean;
	prettyLinkFields: string[];
	projectCreationPathTemplate: string;
	projectCreationTemplatePath: string;
	baseFilePath: string;
	boardColumnWidth: number;
	colorfulBoard: boolean;
	boardCardLayout: BoardCardLayout;
	showTableColumnDividers: boolean;
	boardColumnOrder: string[];
	boardCardOrder: string[];
	collapsedBoardColumns: string[];
}

export const MIN_BOARD_COLUMN_WIDTH = 220;
export const MAX_BOARD_COLUMN_WIDTH = 520;
export const BOARD_COLUMN_WIDTH_STEP = 20;

export const DEFAULT_PROJECT_CREATION_TEMPLATE = [
	"---",
	"{{project_properties}}",
	"---",
	"",
	"# {{title}}",
	"",
	"{{next_action}}",
	"",
].join("\n");

export const DEFAULT_SETTINGS: SimpleProjectViewsSettings = {
	projectMatchType: "tag",
	projectTag: "project",
	projectPropertyName: "",
	projectPropertyValue: "",
	projectFolder: "",
	propertyNames: {
		icon: "icon",
		status: "status",
		progress: "progress",
		due: "due",
		delegatedTo: "delegated_to",
		followUp: "follow_up",
		nextAction: "next_action",
		blockedReason: "blocked_reason",
	},
	relationshipsEnabled: true,
	relationshipPropertyNames: {
		parent: "parent",
		children: "children",
	},
	relationshipDetailFields: ["status"],
	enabledProperties: {
		icon: true,
		progress: true,
		due: true,
		delegatedTo: true,
		followUp: true,
		nextAction: true,
		blockedReason: true,
	},
	projectProperties: cloneProjectProperties(DEFAULT_PROJECT_PROPERTIES),
	statusOptions: ["todo", "in-progress", "blocked", "backlog", "done", "cancelled"],
	statusColors: {
		todo: "#5b7cfa",
		"in-progress": "#d8892b",
		blocked: "#d84c4c",
		backlog: "#8a8a8a",
		done: "#35a35c",
		cancelled: "#6f6f6f",
	},
	statusDisplay: "colored-outline",
	showProjectToolbar: true,
	noteToolbarPosition: "top",
	prettyLinksEnabled: true,
	prettyLinkShowPropertyNames: true,
	prettyLinkFields: ["status"],
	projectCreationPathTemplate: "Projects/{{safe_title}}.md",
	projectCreationTemplatePath: "",
	baseFilePath: "Project views.base",
	boardColumnWidth: 280,
	colorfulBoard: false,
	boardCardLayout: "default",
	showTableColumnDividers: true,
	boardColumnOrder: [],
	boardCardOrder: [],
	collapsedBoardColumns: [],
};

const EXAMPLE_PROJECT_PROPERTY_NAME = "type";
const EXAMPLE_PROJECT_PROPERTY_VALUE = "project";
const EXAMPLE_NEW_STATUS = "waiting";
const FALLBACK_STATUS_COLOR = "#8a8a8a";
const STATUS_DISPLAY_MODES: StatusDisplayMode[] = ["text", "colored-text", "outline", "colored-outline", "filled"];

const TAB_LABELS: Record<SettingsTabId, string> = {
	general: "General",
	views: "Views",
	noteBar: "Note bar",
	prettyLinks: "Pretty links",
	relationships: "Relationships",
	statuses: "Statuses",
	properties: "Properties",
};

export function parseListSetting(value: string): string[] {
	return value
		.split(/[\n,]/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

export function formatListSetting(value: string[]): string {
	return value.join(", ");
}

export function normalizeSettings(settings: Partial<SimpleProjectViewsSettings> = {}): SimpleProjectViewsSettings {
	const propertyNames = normalizeProjectPropertyNames(settings.propertyNames);
	const relationshipPropertyNames = normalizeProjectRelationshipPropertyNames(settings.relationshipPropertyNames);
	const relationshipDetailFields = normalizeRelationshipDetailFields(settings.relationshipDetailFields);
	const enabledProperties = normalizeProjectPropertyToggles(settings.enabledProperties);
	const projectProperties = Array.isArray(settings.projectProperties)
		? normalizeProjectPropertyDefinitions(settings.projectProperties)
		: migrateLegacyProjectProperties(propertyNames, enabledProperties);
	const statusOptions = normalizeStatusOptions(settings.statusOptions);
	const prettyLinkFields = normalizePrettyLinkFields(settings.prettyLinkFields, projectProperties);

	return {
		...DEFAULT_SETTINGS,
		...settings,
		propertyNames,
		relationshipsEnabled: readBoolean(settings.relationshipsEnabled, DEFAULT_SETTINGS.relationshipsEnabled),
		relationshipPropertyNames,
		relationshipDetailFields,
		enabledProperties,
		projectProperties,
		statusOptions,
		statusColors: normalizeStatusColors(settings.statusColors, statusOptions),
		statusDisplay: normalizeStatusDisplay(settings.statusDisplay),
		prettyLinksEnabled: readBoolean(settings.prettyLinksEnabled, DEFAULT_SETTINGS.prettyLinksEnabled),
		prettyLinkShowPropertyNames: readBoolean(settings.prettyLinkShowPropertyNames, DEFAULT_SETTINGS.prettyLinkShowPropertyNames),
		prettyLinkFields,
		projectMatchType: normalizeProjectMatchType(settings.projectMatchType),
		projectTag: typeof settings.projectTag === "string" ? normalizeProjectTag(settings.projectTag) : DEFAULT_SETTINGS.projectTag,
		projectPropertyName: typeof settings.projectPropertyName === "string" ? settings.projectPropertyName.trim() : DEFAULT_SETTINGS.projectPropertyName,
		projectPropertyValue: typeof settings.projectPropertyValue === "string" ? settings.projectPropertyValue.trim() : DEFAULT_SETTINGS.projectPropertyValue,
		projectFolder: normalizeProjectFolder(settings.projectFolder),
		noteToolbarPosition: normalizeProjectToolbarPosition(settings.noteToolbarPosition),
		projectCreationPathTemplate: normalizeProjectCreationPathTemplate(settings.projectCreationPathTemplate),
		projectCreationTemplatePath: normalizeProjectTemplatePath(settings.projectCreationTemplatePath),
		boardColumnWidth: normalizeBoardColumnWidth(settings.boardColumnWidth),
		colorfulBoard: normalizeColorfulBoard(settings.colorfulBoard),
		boardCardLayout: normalizeBoardCardLayout(settings.boardCardLayout),
		showTableColumnDividers: normalizeShowTableColumnDividers(settings.showTableColumnDividers),
		boardColumnOrder: normalizeStringList(settings.boardColumnOrder),
		boardCardOrder: normalizeStringList(settings.boardCardOrder),
		collapsedBoardColumns: normalizeStringList(settings.collapsedBoardColumns),
	};
}

export function normalizeBoardColumnWidth(value: unknown): number {
	const numericValue = typeof value === "number" ? value : Number.parseInt(String(value), 10);
	if (!Number.isFinite(numericValue)) {
		return DEFAULT_SETTINGS.boardColumnWidth;
	}

	return Math.max(MIN_BOARD_COLUMN_WIDTH, Math.min(MAX_BOARD_COLUMN_WIDTH, numericValue));
}

export function getStatusColor(settings: SimpleProjectViewsSettings, status: string): string {
	return settings.statusColors[status] ?? DEFAULT_SETTINGS.statusColors[status] ?? FALLBACK_STATUS_COLOR;
}

export function normalizeStatusDisplay(value: unknown): StatusDisplayMode {
	return typeof value === "string" && STATUS_DISPLAY_MODES.includes(value as StatusDisplayMode)
		? value as StatusDisplayMode
		: DEFAULT_SETTINGS.statusDisplay;
}

export function normalizePrettyLinkFields(
	value: unknown,
	projectProperties = DEFAULT_SETTINGS.projectProperties,
): string[] {
	if (!Array.isArray(value)) {
		return [...DEFAULT_SETTINGS.prettyLinkFields];
	}

	const allowedFields = new Set([
		"status",
		...projectProperties
			.filter((property) => property.name.trim().length > 0)
			.map((property) => property.id),
	]);
	const requestedFields = new Set(normalizeStringList(value).filter((field) => allowedFields.has(field)));

	return getOrderedPrettyLinkFields({projectProperties}, requestedFields);
}

export function getOrderedPrettyLinkFields(
	settings: Pick<SimpleProjectViewsSettings, "projectProperties">,
	fields: Set<string>,
): string[] {
	const orderedFields = [
		"status",
		...settings.projectProperties
			.filter((property) => property.name.trim().length > 0)
			.map((property) => property.id),
	];

	return orderedFields.filter((field) => fields.has(field));
}

export function getStatusDisplayClassName(mode: StatusDisplayMode): string {
	return `spv-status-badge spv-status-display-${mode}`;
}

export function getStatusDisplayLabel(mode: StatusDisplayMode): string {
	switch (mode) {
		case "colored-text":
			return "Colored text";
		case "colored-outline":
			return "Colored outline";
		case "filled":
			return "Filled";
		case "outline":
			return "Outline";
		case "text":
			return "Text";
	}
}

function migrateLegacyProjectProperties(
	propertyNames: ProjectPropertyNames,
	enabledProperties: ProjectPropertyToggles,
): ProjectPropertyDefinition[] {
	return DEFAULT_PROJECT_PROPERTIES
		.filter((property) => {
			const key = property.id as ToggleableProjectPropertyKey;
			return enabledProperties[key] !== false;
		})
		.map((property) => {
			const key = property.id as ToggleableProjectPropertyKey;
			return {
				...property,
				name: propertyNames[key] ?? property.name,
			};
		});
}

export function normalizeProjectMatchType(value: unknown): ProjectMatchType {
	return value === "property" || value === "folder" || value === "tag" ? value : DEFAULT_SETTINGS.projectMatchType;
}

export function normalizeProjectToolbarPosition(value: unknown): ProjectToolbarPosition {
	return value === "top" || value === "bottom" || value === "left" || value === "right" ? value : DEFAULT_SETTINGS.noteToolbarPosition;
}

function normalizeProjectTag(value: string): string {
	return value.trim().replace(/^#/, "");
}

function normalizeProjectFolder(value: unknown): string {
	return typeof value === "string" ? value.trim().replace(/^\/+|\/+$/g, "") : DEFAULT_SETTINGS.projectFolder;
}

function normalizeProjectCreationPathTemplate(value: unknown): string {
	if (typeof value !== "string" || !value.trim()) {
		return DEFAULT_SETTINGS.projectCreationPathTemplate;
	}

	return value.trim().replace(/^\/+/, "");
}

function normalizeProjectTemplatePath(value: unknown): string {
	return typeof value === "string" ? value.trim().replace(/^\/+/, "") : DEFAULT_SETTINGS.projectCreationTemplatePath;
}

function normalizeStatusOptions(statusOptions: unknown): string[] {
	const normalizedOptions = unique((Array.isArray(statusOptions) ? statusOptions : DEFAULT_SETTINGS.statusOptions)
		.filter((status): status is string => typeof status === "string")
		.map((status) => status.trim())
		.filter((status) => status.length > 0));

	return normalizedOptions;
}

function normalizeStatusColors(statusColors: unknown, statusOptions: string[]): Record<string, string> {
	const colorRecord = isRecord(statusColors) ? statusColors : {};
	const normalizedColors: Record<string, string> = {};

	for (const status of statusOptions) {
		normalizedColors[status] = normalizeStatusColor(readString(colorRecord[status]) || DEFAULT_SETTINGS.statusColors[status]);
	}

	return normalizedColors;
}

function normalizeStatusColor(value: unknown): string {
	if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) {
		return value;
	}

	return FALLBACK_STATUS_COLOR;
}

function normalizeProjectPropertyNames(value: unknown): ProjectPropertyNames {
	const propertyNames = isRecord(value) ? value : {};

	return {
		icon: readString(propertyNames.icon) ?? DEFAULT_SETTINGS.propertyNames.icon,
		status: readString(propertyNames.status) ?? DEFAULT_SETTINGS.propertyNames.status,
		progress: readString(propertyNames.progress) ?? DEFAULT_SETTINGS.propertyNames.progress,
		due: readString(propertyNames.due) ?? DEFAULT_SETTINGS.propertyNames.due,
		delegatedTo: readString(propertyNames.delegatedTo) ?? DEFAULT_SETTINGS.propertyNames.delegatedTo,
		followUp: readString(propertyNames.followUp) ?? DEFAULT_SETTINGS.propertyNames.followUp,
		nextAction: readString(propertyNames.nextAction) ?? DEFAULT_SETTINGS.propertyNames.nextAction,
		blockedReason: readString(propertyNames.blockedReason) ?? DEFAULT_SETTINGS.propertyNames.blockedReason,
	};
}

function normalizeProjectRelationshipPropertyNames(value: unknown): ProjectRelationshipPropertyNames {
	const propertyNames = isRecord(value) ? value : {};

	return {
		parent: readNonEmptyString(propertyNames.parent) ?? DEFAULT_SETTINGS.relationshipPropertyNames.parent,
		children: readNonEmptyString(propertyNames.children) ?? DEFAULT_SETTINGS.relationshipPropertyNames.children,
	};
}

function normalizeRelationshipDetailFields(value: unknown): string[] {
	return Array.isArray(value)
		? normalizeStringList(value)
		: DEFAULT_SETTINGS.relationshipDetailFields;
}

function normalizeProjectPropertyToggles(value: unknown): ProjectPropertyToggles {
	const toggles = isRecord(value) ? value : {};

	return {
		icon: readBoolean(toggles.icon, DEFAULT_SETTINGS.enabledProperties.icon),
		progress: readBoolean(toggles.progress, DEFAULT_SETTINGS.enabledProperties.progress),
		due: readBoolean(toggles.due, DEFAULT_SETTINGS.enabledProperties.due),
		delegatedTo: readBoolean(toggles.delegatedTo, DEFAULT_SETTINGS.enabledProperties.delegatedTo),
		followUp: readBoolean(toggles.followUp, DEFAULT_SETTINGS.enabledProperties.followUp),
		nextAction: readBoolean(toggles.nextAction, DEFAULT_SETTINGS.enabledProperties.nextAction),
		blockedReason: readBoolean(toggles.blockedReason, DEFAULT_SETTINGS.enabledProperties.blockedReason),
	};
}

function normalizeStringList(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return unique(value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter((item) => item.length > 0));
}

function readString(value: unknown): string | null {
	return typeof value === "string" ? value.trim() : null;
}

function readNonEmptyString(value: unknown): string | null {
	const stringValue = readString(value);
	return stringValue && stringValue.length > 0 ? stringValue : null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class SimpleProjectViewsSettingTab extends PluginSettingTab {
	plugin: SimpleProjectViewsPlugin;
	private activeTab: SettingsTabId = "general";
	private editingStatus: string | null = null;
	private readonly expandedProjectProperties = new Set<string>();

	constructor(app: App, plugin: SimpleProjectViewsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		this.addHeading(containerEl, "Simple project views");
		this.displayTabs(containerEl);

		if (this.activeTab === "general") {
			this.displayGeneral(containerEl);
		} else if (this.activeTab === "views") {
			this.displayViews(containerEl);
		} else if (this.activeTab === "noteBar") {
			this.displayNoteBar(containerEl);
		} else if (this.activeTab === "prettyLinks") {
			this.displayPrettyLinks(containerEl);
		} else if (this.activeTab === "relationships") {
			this.displayRelationships(containerEl);
		} else if (this.activeTab === "statuses") {
			this.displayStatuses(containerEl);
		} else {
			this.displayProperties(containerEl);
		}
	}

	private displayTabs(containerEl: HTMLElement): void {
		const tabsEl = containerEl.createDiv({cls: "spv-settings-tabs"});

		for (const [tabId, label] of Object.entries(TAB_LABELS) as Array<[SettingsTabId, string]>) {
			const tabEl = tabsEl.createEl("button", {
				cls: `spv-settings-tab${this.activeTab === tabId ? " is-active" : ""}`,
				text: label,
				attr: {
					type: "button",
					"aria-pressed": String(this.activeTab === tabId),
				},
			});
			tabEl.addEventListener("click", () => {
				this.activeTab = tabId;
				this.display();
			});
		}
	}

	private displayGeneral(containerEl: HTMLElement): void {
		this.addHeading(containerEl, "Match criteria");

		new Setting(containerEl)
			.setName("Project notes")
			.setDesc("Choose how notes are recognized as projects.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("tag", "Match tag")
					.addOption("property", "Match property")
					.addOption("folder", "Match folder")
					.setValue(this.plugin.settings.projectMatchType)
					.onChange(async (value) => {
						this.plugin.settings.projectMatchType = normalizeProjectMatchType(value);
						await this.plugin.saveSettings();
						this.display();
					});
			});

		this.addProjectMatchSetting(containerEl);

		this.addHeading(containerEl, "Creation");

		new Setting(containerEl)
			.setName("Project creation path")
			.setDesc("Path template for new project notes. Use {{safe_title}}, {{title}}, {{slug}}, or {{project_folder}}.")
			.addText((text) => {
				text
					.setPlaceholder(DEFAULT_SETTINGS.projectCreationPathTemplate)
					.setValue(this.plugin.settings.projectCreationPathTemplate)
					.onChange(async (value) => {
						this.plugin.settings.projectCreationPathTemplate = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Project template")
			.setDesc("Markdown file used by the create project command.")
			.addSearch((search) => {
				search
					.setPlaceholder("Templates/Project.md")
					.setValue(this.plugin.settings.projectCreationTemplatePath)
					.onChange(async (value) => {
						this.plugin.settings.projectCreationTemplatePath = normalizeProjectTemplatePath(value);
						await this.plugin.saveSettings();
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("folder-open")
					.setTooltip("Choose template")
					.onClick(() => {
						new MarkdownFileSuggestModal(this.app, this.plugin.settings.projectCreationTemplatePath, async (file) => {
							this.plugin.settings.projectCreationTemplatePath = file.path;
							await this.plugin.saveSettings();
							this.display();
						}).open();
					});
			});
	}

	private addProjectMatchSetting(containerEl: HTMLElement): void {
		if (this.plugin.settings.projectMatchType === "tag") {
			new Setting(containerEl)
				.setName("Project tag")
				.setDesc("Notes with this tag are projects. Use the tag name without #.")
				.addText((text) => {
					text
						.setPlaceholder(DEFAULT_SETTINGS.projectTag)
						.setValue(this.plugin.settings.projectTag)
						.onChange(async (value) => {
							this.plugin.settings.projectTag = normalizeProjectTag(value);
							await this.plugin.saveSettings();
						});
				});
			return;
		}

		if (this.plugin.settings.projectMatchType === "property") {
			new Setting(containerEl)
				.setName("Project property")
				.setDesc("Leave value empty to match any non-empty property value.")
				.addText((text) => {
					text
						.setPlaceholder(EXAMPLE_PROJECT_PROPERTY_NAME)
						.setValue(this.plugin.settings.projectPropertyName)
						.onChange(async (value) => {
							this.plugin.settings.projectPropertyName = value.trim();
							await this.plugin.saveSettings();
						});
				})
				.addText((text) => {
					text
						.setPlaceholder(EXAMPLE_PROJECT_PROPERTY_VALUE)
						.setValue(this.plugin.settings.projectPropertyValue)
						.onChange(async (value) => {
							this.plugin.settings.projectPropertyValue = value.trim();
							await this.plugin.saveSettings();
						});
				});
			return;
		}

		new Setting(containerEl)
			.setName("Project folder")
			.setDesc("Notes in this folder are projects.")
			.addText((text) => {
				text
					.setPlaceholder("Projects")
					.setValue(this.plugin.settings.projectFolder)
					.onChange(async (value) => {
						this.plugin.settings.projectFolder = normalizeProjectFolder(value);
						await this.plugin.saveSettings();
					});
			});
	}

	private displayViews(containerEl: HTMLElement): void {
		this.addHeading(containerEl, "Views");

		new Setting(containerEl)
			.setName("Base file path")
			.setDesc("Path for the create project base command.")
			.addText((text) => {
				text
					.setPlaceholder(DEFAULT_SETTINGS.baseFilePath)
					.setValue(this.plugin.settings.baseFilePath)
					.onChange(async (value) => {
						this.plugin.settings.baseFilePath = value.trim();
						await this.plugin.saveSettings();
					});
			});

		this.addHeading(containerEl, "Board");

		const widthValueEl = document.createElement("span");
		widthValueEl.addClass("spv-setting-value");
		widthValueEl.setText(`${this.plugin.settings.boardColumnWidth}px`);

		new Setting(containerEl)
			.setName("Column width")
			.setDesc("Width used for project board columns.")
			.addSlider((slider) => {
				slider
					.setLimits(MIN_BOARD_COLUMN_WIDTH, MAX_BOARD_COLUMN_WIDTH, BOARD_COLUMN_WIDTH_STEP)
					.setValue(this.plugin.settings.boardColumnWidth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.boardColumnWidth = normalizeBoardColumnWidth(value);
						widthValueEl.setText(`${this.plugin.settings.boardColumnWidth}px`);
						await this.plugin.saveSettings();
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("reset")
					.setTooltip("Reset board layout")
					.onClick(async () => {
						this.plugin.settings.boardColumnOrder = [];
						this.plugin.settings.boardCardOrder = [];
						this.plugin.settings.collapsedBoardColumns = [];
						await this.plugin.saveSettings();
						this.display();
					});
			})
			.then((setting) => {
				setting.controlEl.prepend(widthValueEl);
			});

		new Setting(containerEl)
			.setName("Colorful board")
			.setDesc("Tint board columns and cards using status colors.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.colorfulBoard)
					.onChange(async (value) => {
						this.plugin.settings.colorfulBoard = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Card layout")
			.setDesc("Choose the spacing used for board cards.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("compact", "Compact")
					.addOption("default", "Default")
					.addOption("spacious", "Spacious")
					.setValue(this.plugin.settings.boardCardLayout)
					.onChange(async (value) => {
						this.plugin.settings.boardCardLayout = normalizeBoardCardLayout(value);
						await this.plugin.saveSettings();
					});
			});

		this.addHeading(containerEl, "Table");

		new Setting(containerEl)
			.setName("Show column dividers")
			.setDesc("Show vertical dividers between project table columns.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showTableColumnDividers)
					.onChange(async (value) => {
						this.plugin.settings.showTableColumnDividers = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private displayNoteBar(containerEl: HTMLElement): void {
		this.addHeading(containerEl, "Note bar");

		new Setting(containerEl)
			.setName("Show note bar")
			.setDesc("Show floating project controls in project notes.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showProjectToolbar)
					.onChange(async (value) => {
						this.plugin.settings.showProjectToolbar = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Position")
			.setDesc("Choose where the note bar appears in project notes.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("top", "Top")
					.addOption("bottom", "Bottom")
					.addOption("left", "Left")
					.addOption("right", "Right")
					.setValue(this.plugin.settings.noteToolbarPosition)
					.onChange(async (value) => {
						this.plugin.settings.noteToolbarPosition = normalizeProjectToolbarPosition(value);
						await this.plugin.saveSettings();
					});
				});
	}

	private displayPrettyLinks(containerEl: HTMLElement): void {
		this.addHeading(containerEl, "Pretty links");

		new Setting(containerEl)
			.setName("Enable pretty links")
			.setDesc("Render links to project notes as compact project links.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.prettyLinksEnabled)
					.onChange(async (value) => {
						this.plugin.settings.prettyLinksEnabled = value;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName("Show property names")
			.setDesc("Show property labels before values on pretty links.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.prettyLinkShowPropertyNames)
					.setDisabled(!this.plugin.settings.prettyLinksEnabled)
					.onChange(async (value) => {
						this.plugin.settings.prettyLinkShowPropertyNames = value;
						await this.plugin.saveSettings();
					});
			});

		this.addHeading(containerEl, "Fields");
		this.addPrettyLinkFieldSetting(containerEl, "status", "Status");
		for (const property of this.plugin.settings.projectProperties) {
			if (property.name.trim()) {
				this.addPrettyLinkFieldSetting(containerEl, property.id, property.label || property.name);
			}
		}
	}

	private addPrettyLinkFieldSetting(containerEl: HTMLElement, field: string, label: string): void {
		const enabledFields = new Set(this.plugin.settings.prettyLinkFields);

		new Setting(containerEl)
			.setName(label)
			.setDesc("Show this field on pretty project links.")
			.addToggle((toggle) => {
				toggle
					.setValue(enabledFields.has(field))
					.setDisabled(!this.plugin.settings.prettyLinksEnabled)
					.onChange(async (value) => {
						this.plugin.settings.prettyLinkFields = this.getPrettyLinkFields(field, value);
						await this.plugin.saveSettings();
					});
			});
	}

	private getPrettyLinkFields(field: string, enabled: boolean): string[] {
		const fields = new Set(this.plugin.settings.prettyLinkFields);
		if (enabled) {
			fields.add(field);
		} else {
			fields.delete(field);
		}

		return getOrderedPrettyLinkFields(this.plugin.settings, fields);
	}

	private displayRelationships(containerEl: HTMLElement): void {
		this.addHeading(containerEl, "Relationships");

		new Setting(containerEl)
			.setName("Enable relationships")
			.setDesc("Show parent and child project links, and enable child project creation.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.relationshipsEnabled)
					.onChange(async (value) => {
						this.plugin.settings.relationshipsEnabled = value;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName("Parent property")
			.setDesc("Note property used to store the parent project link.")
			.addText((text) => {
				text
					.setPlaceholder(DEFAULT_SETTINGS.relationshipPropertyNames.parent)
					.setValue(this.plugin.settings.relationshipPropertyNames.parent)
					.setDisabled(!this.plugin.settings.relationshipsEnabled)
					.onChange(async (value) => {
						this.plugin.settings.relationshipPropertyNames.parent = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Children property")
			.setDesc("Note property used to store child project links.")
			.addText((text) => {
				text
					.setPlaceholder(DEFAULT_SETTINGS.relationshipPropertyNames.children)
					.setValue(this.plugin.settings.relationshipPropertyNames.children)
					.setDisabled(!this.plugin.settings.relationshipsEnabled)
					.onChange(async (value) => {
						this.plugin.settings.relationshipPropertyNames.children = value.trim();
						await this.plugin.saveSettings();
					});
			});

		this.addHeading(containerEl, "Relationship details");
		this.addRelationshipDetailFieldSetting(containerEl, "status", "Status");
		for (const property of this.plugin.settings.projectProperties) {
			if (property.name.trim()) {
				this.addRelationshipDetailFieldSetting(containerEl, property.id, property.label || property.name);
			}
		}
	}

	private addRelationshipDetailFieldSetting(containerEl: HTMLElement, field: string, label: string): void {
		const enabledFields = new Set(this.plugin.settings.relationshipDetailFields);

		new Setting(containerEl)
			.setName(label)
			.setDesc("Show this field below related project links.")
			.addToggle((toggle) => {
				toggle
					.setValue(enabledFields.has(field))
					.onChange(async (value) => {
						this.plugin.settings.relationshipDetailFields = this.getRelationshipDetailFields(field, value);
						await this.plugin.saveSettings();
					});
			});
	}

	private getRelationshipDetailFields(field: string, enabled: boolean): string[] {
		const fields = new Set(this.plugin.settings.relationshipDetailFields);
		if (enabled) {
			fields.add(field);
		} else {
			fields.delete(field);
		}

		const orderedFields = [
			"status",
			...this.plugin.settings.projectProperties.map((property) => property.id),
		];
		return orderedFields.filter((candidate) => fields.has(candidate));
	}

	private displayStatuses(containerEl: HTMLElement): void {
		this.addHeading(containerEl, "Statuses");
		this.addStatusPropertySetting(containerEl);
		this.addStatusDisplaySetting(containerEl);

		for (let index = 0; index < this.plugin.settings.statusOptions.length; index += 1) {
			const status = this.plugin.settings.statusOptions[index];
			if (status) {
				this.addStatusSetting(containerEl, status, index);
			}
		}

		this.addNewStatusSetting(containerEl);
	}

	private addStatusSetting(containerEl: HTMLElement, status: string, index: number): void {
		const isEditingName = this.editingStatus === status;
		const setting = new Setting(containerEl)
			.setName(isEditingName ? "Status name" : status)
			.setClass("spv-status-setting");

		if (isEditingName) {
			setting.addText((text) => {
				let shouldSaveName = true;
				const saveStatusName = () => {
					if (!shouldSaveName) {
						return;
					}

					this.editingStatus = null;
					void this.renameStatus(index, status, text.getValue());
				};

				text
					.setValue(status)
					.setPlaceholder(DEFAULT_SETTINGS.propertyNames.status);
				text.inputEl.addEventListener("blur", saveStatusName);
				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						text.inputEl.blur();
					} else if (event.key === "Escape") {
						shouldSaveName = false;
						this.editingStatus = null;
						this.display();
					}
				});

				window.requestAnimationFrame(() => {
					text.inputEl.focus();
					text.inputEl.select();
				});
			});
		} else {
			setting.addExtraButton((button) => {
				button
					.setIcon("pencil")
					.onClick(() => {
						this.editingStatus = status;
						this.display();
					});
			});
		}

		setting
			.addColorPicker((color) => {
				color
					.setValue(getStatusColor(this.plugin.settings, status))
					.onChange(async (value) => {
						this.plugin.settings.statusColors[status] = normalizeStatusColor(value);
						await this.plugin.saveSettings();
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("arrow-up")
					.setDisabled(index === 0)
					.onClick(async () => {
						await this.moveStatus(index, index - 1);
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("arrow-down")
					.setDisabled(index === this.plugin.settings.statusOptions.length - 1)
					.onClick(async () => {
						await this.moveStatus(index, index + 1);
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("trash")
					.onClick(async () => {
						await this.confirmDeleteStatus(status);
					});
			});
	}

	private addNewStatusSetting(containerEl: HTMLElement): void {
		let newStatus = "";

		new Setting(containerEl)
			.setName("New status")
			.addText((text) => {
				text
					.setPlaceholder(EXAMPLE_NEW_STATUS)
					.onChange((value) => {
						newStatus = value;
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Add")
					.setCta()
					.onClick(async () => {
						await this.addStatus(newStatus);
					});
			});
	}

	private displayProperties(containerEl: HTMLElement): void {
		this.addHeading(containerEl, "Properties");

		this.addIconPropertySetting(containerEl);

		for (let index = 0; index < this.plugin.settings.projectProperties.length; index += 1) {
			const property = this.plugin.settings.projectProperties[index];
			if (property) {
				this.addProjectPropertySetting(containerEl, property, index);
			}
		}

		this.addNewProjectPropertySetting(containerEl);
	}

	private addStatusPropertySetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Status note property")
			.setDesc("Property name used to store project status.")
			.addText((text) => {
				text
					.setPlaceholder(DEFAULT_SETTINGS.propertyNames.status)
					.setValue(this.plugin.settings.propertyNames.status)
					.onChange(async (value) => {
						this.plugin.settings.propertyNames.status = value.trim();
						await this.plugin.saveSettings();
					});
			});
	}

	private addStatusDisplaySetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Status display")
			.setDesc("Choose how status labels appear in project views.")
			.addDropdown((dropdown) => {
				for (const mode of STATUS_DISPLAY_MODES) {
					dropdown.addOption(mode, getStatusDisplayLabel(mode));
				}

				dropdown
					.setValue(this.plugin.settings.statusDisplay)
					.onChange(async (value) => {
						this.plugin.settings.statusDisplay = normalizeStatusDisplay(value);
						await this.plugin.saveSettings();
					});
			});
	}

	private addIconPropertySetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Project icon")
			.setDesc("Built-in field shown next to project titles.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enabledProperties.icon)
					.onChange(async (value) => {
						this.plugin.settings.enabledProperties.icon = value;
						await this.plugin.saveSettings();
						this.display();
					});
			})
			.addText((text) => {
				text
					.setPlaceholder(DEFAULT_SETTINGS.propertyNames.icon)
					.setValue(this.plugin.settings.propertyNames.icon)
					.setDisabled(!this.plugin.settings.enabledProperties.icon)
					.onChange(async (value) => {
						this.plugin.settings.propertyNames.icon = value.trim();
						await this.plugin.saveSettings();
					});
			});
	}

	private addProjectPropertySetting(
		containerEl: HTMLElement,
		property: ProjectPropertyDefinition,
		index: number,
	): void {
		const renderModes = getCompatibleRenderModes(property.type);
		const title = property.label || property.name || "Untitled property";
		const desc = property.name
			? `Note property: ${property.name}. Rendered as ${getPropertyRenderModeLabel(property.render).toLowerCase()}.`
			: `Rendered as ${getPropertyRenderModeLabel(property.render).toLowerCase()}.`;
		const isExpanded = this.expandedProjectProperties.has(property.id);

		new Setting(containerEl)
			.setName(title)
			.setDesc(desc)
			.setHeading()
			.addExtraButton((button) => {
				button
					.setIcon(isExpanded ? "chevron-down" : "chevron-right")
					.setTooltip(isExpanded ? "Collapse property" : "Expand property")
					.onClick(() => {
						if (isExpanded) {
							this.expandedProjectProperties.delete(property.id);
						} else {
							this.expandedProjectProperties.add(property.id);
						}
						this.display();
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("arrow-up")
					.setTooltip("Move up")
					.setDisabled(index === 0)
					.onClick(async () => {
						await this.moveProjectProperty(index, index - 1);
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("arrow-down")
					.setTooltip("Move down")
					.setDisabled(index === this.plugin.settings.projectProperties.length - 1)
					.onClick(async () => {
						await this.moveProjectProperty(index, index + 1);
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("trash")
					.setTooltip("Delete property")
					.onClick(async () => {
						await this.confirmDeleteProjectProperty(index);
					});
			});

		if (!isExpanded) {
			return;
		}

		new Setting(containerEl)
			.setName("Label")
			.setDesc("Name shown in views.")
			.addText((text) => {
				text
					.setPlaceholder("Label")
					.setValue(property.label)
					.onChange(async (value) => {
						await this.updateProjectProperty(index, {label: value.trim()});
					});
			});

		new Setting(containerEl)
			.setName("Note property")
			.setDesc("Property name stored in the note.")
			.addText((text) => {
				text
					.setPlaceholder("Property name")
					.setValue(property.name)
					.onChange(async (value) => {
						await this.updateProjectProperty(index, {name: value.trim()});
					});
			});

		new Setting(containerEl)
			.setName("Value type")
			.setDesc("Stored value.")
			.addDropdown((dropdown) => {
				for (const type of getPropertyTypes()) {
					dropdown.addOption(type, getPropertyTypeLabel(type));
				}

				dropdown
					.setValue(property.type)
					.onChange(async (value) => {
						const type = normalizePropertyType(value);
						await this.updateProjectProperty(index, {
							type,
							render: normalizePropertyRenderMode(type, property.render),
						}, true);
					});
			});

		new Setting(containerEl)
			.setName("Render as")
			.setDesc("Display and edit control.")
			.addDropdown((dropdown) => {
				for (const renderMode of renderModes) {
					dropdown.addOption(renderMode, getPropertyRenderModeLabel(renderMode));
				}

				dropdown
					.setValue(property.render)
					.onChange(async (value) => {
						await this.updateProjectProperty(index, {
							render: normalizePropertyRenderMode(property.type, value),
						}, true);
					});
			});

		new Setting(containerEl)
			.setName("View label")
			.setDesc("Show the property name or its icon in summaries.")
			.addDropdown((dropdown) => {
				for (const labelMode of getPropertyLabelModes()) {
					dropdown.addOption(labelMode, getPropertyLabelModeLabel(labelMode));
				}

				dropdown
					.setValue(property.labelMode)
					.onChange(async (value) => {
						await this.updateProjectProperty(index, {
							labelMode: normalizePropertyLabelMode(value),
						}, true);
					});
			});

		new Setting(containerEl)
			.setName("Label icon")
			.setDesc("Used when view label is set to icon.")
			.addText((text) => {
				text
					.setPlaceholder("Icon name")
					.setValue(property.icon)
					.onChange(async (value) => {
						await this.updateProjectProperty(index, {icon: value.trim()});
					});
				text.inputEl.addClass(`spv-property-label-icon-input-${property.id}`);
			})
			.addExtraButton((button) => {
				button
					.setIcon("image")
					.setTooltip("Choose icon")
					.onClick(() => {
						const inputEl = this.containerEl.querySelector(`.spv-property-label-icon-input-${property.id}`);
						new ProjectIconSuggestModal(this.app, property.icon, async (icon) => {
							await this.updateProjectProperty(index, {icon});
							if (inputEl instanceof HTMLInputElement) {
								inputEl.value = icon;
							}
						}).open();
					});
			});

		if (property.render === "progress" || property.render === "stars") {
			new Setting(containerEl)
				.setName("Minimum")
				.setDesc("Smallest allowed number.")
				.addText((text) => {
					text
						.setPlaceholder("Min")
						.setValue(String(property.min))
						.onChange(async (value) => {
							await this.updateProjectPropertyNumber(index, "min", value);
						});
					text.inputEl.type = "number";
				});

			new Setting(containerEl)
				.setName("Maximum")
				.setDesc(property.render === "stars" ? "Number of stars to show." : "Largest allowed number.")
				.addText((text) => {
					text
						.setPlaceholder("Max")
						.setValue(String(property.max))
						.onChange(async (value) => {
							await this.updateProjectPropertyNumber(index, "max", value);
						});
					text.inputEl.type = "number";
				});
		}

		if (property.render === "progress") {
			new Setting(containerEl)
				.setName("Step")
				.setDesc("Slider increment.")
				.addText((text) => {
					text
						.setPlaceholder("Step")
						.setValue(String(property.step))
						.onChange(async (value) => {
							await this.updateProjectPropertyNumber(index, "step", value);
						});
					text.inputEl.type = "number";
				});
		}
	}

	private addNewProjectPropertySetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("New property")
			.setDesc("Add any note property and choose how it appears in project views.")
			.addButton((button) => {
				button
					.setButtonText("Add")
					.setCta()
					.onClick(async () => {
						const property = createProjectPropertyDefinition(this.plugin.settings.projectProperties);
						this.plugin.settings.projectProperties = [
							...this.plugin.settings.projectProperties,
							property,
						];
						this.expandedProjectProperties.add(property.id);
						await this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private async updateProjectProperty(
		index: number,
		property: Partial<ProjectPropertyDefinition>,
		rerender = false,
	): Promise<void> {
		const properties = [...this.plugin.settings.projectProperties];
		const currentProperty = properties[index];
		if (!currentProperty) {
			return;
		}

		properties[index] = {
			...currentProperty,
			...property,
		};
		this.plugin.settings.projectProperties = properties;
		await this.plugin.saveSettings();

		if (rerender) {
			this.display();
		}
	}

	private async updateProjectPropertyNumber(
		index: number,
		key: "min" | "max" | "step",
		value: string,
	): Promise<void> {
		const numberValue = Number.parseFloat(value);
		if (!Number.isFinite(numberValue)) {
			return;
		}

		await this.updateProjectProperty(index, {[key]: numberValue});
	}

	private async moveProjectProperty(fromIndex: number, toIndex: number): Promise<void> {
		if (toIndex < 0 || toIndex >= this.plugin.settings.projectProperties.length) {
			return;
		}

		const properties = [...this.plugin.settings.projectProperties];
		const [property] = properties.splice(fromIndex, 1);
		if (!property) {
			return;
		}

		properties.splice(toIndex, 0, property);
		this.plugin.settings.projectProperties = properties;
		await this.plugin.saveSettings();
		this.display();
	}

	private async confirmDeleteProjectProperty(index: number): Promise<void> {
		const property = this.plugin.settings.projectProperties[index];
		if (!property) {
			return;
		}

		const propertyName = property.label || property.name || "Untitled property";
		const confirmed = await confirmDelete(this.app, {
			title: "Delete property",
			message: `Delete "${propertyName}"? This removes the property from project views and new project templates. Existing note values stay in your notes.`,
			confirmText: "Delete property",
		});

		if (confirmed) {
			await this.deleteProjectProperty(index);
		}
	}

	private async deleteProjectProperty(index: number): Promise<void> {
		const property = this.plugin.settings.projectProperties[index];
		if (property) {
			this.expandedProjectProperties.delete(property.id);
		}

		this.plugin.settings.projectProperties = this.plugin.settings.projectProperties.filter((_, propertyIndex) => propertyIndex !== index);
		await this.plugin.saveSettings();
		this.display();
	}

	private async addStatus(value: string): Promise<void> {
		const status = value.trim();
		if (!status) {
			new Notice("Enter a status name");
			return;
		}

		if (this.plugin.settings.statusOptions.includes(status)) {
			new Notice("Status already exists");
			return;
		}

		this.plugin.settings.statusOptions = [...this.plugin.settings.statusOptions, status];
		this.plugin.settings.statusColors[status] = FALLBACK_STATUS_COLOR;
		this.plugin.settings.boardColumnOrder = [...this.plugin.settings.statusOptions];
		await this.plugin.saveSettings();
		this.display();
	}

	private async renameStatus(index: number, oldStatus: string, value: string): Promise<void> {
		const nextStatus = value.trim();
		if (nextStatus === oldStatus) {
			return;
		}

		if (!nextStatus) {
			new Notice("Enter a status name");
			this.display();
			return;
		}

		if (this.plugin.settings.statusOptions.includes(nextStatus)) {
			new Notice("Status already exists");
			this.display();
			return;
		}

		const projectsToRename = this.plugin.projectIndex.getProjects()
			.filter((project) => project.status === oldStatus);
		const statusOptions = [...this.plugin.settings.statusOptions];
		statusOptions[index] = nextStatus;
		this.plugin.settings.statusOptions = statusOptions;
		this.plugin.settings.boardColumnOrder = this.plugin.settings.boardColumnOrder.map((status) => status === oldStatus ? nextStatus : status);
		this.plugin.settings.collapsedBoardColumns = this.plugin.settings.collapsedBoardColumns.map((status) => status === oldStatus ? nextStatus : status);
		this.plugin.settings.statusColors[nextStatus] = getStatusColor(this.plugin.settings, oldStatus);
		delete this.plugin.settings.statusColors[oldStatus];

		await this.plugin.saveSettings();
		try {
			for (const project of projectsToRename) {
				await updateProjectProperty(this.app, project.file, this.plugin.settings.propertyNames.status, nextStatus);
			}
		} catch (error) {
			console.error("Simple project views: could not update renamed project statuses", error);
			new Notice("Could not update all project statuses");
		}
		this.plugin.refreshProjectSurfaces();
		this.display();
	}

	private async moveStatus(fromIndex: number, toIndex: number): Promise<void> {
		if (toIndex < 0 || toIndex >= this.plugin.settings.statusOptions.length) {
			return;
		}

		const statusOptions = [...this.plugin.settings.statusOptions];
		const [status] = statusOptions.splice(fromIndex, 1);
		if (!status) {
			return;
		}

		statusOptions.splice(toIndex, 0, status);
		this.plugin.settings.statusOptions = statusOptions;
		this.plugin.settings.boardColumnOrder = [...statusOptions];
		await this.plugin.saveSettings();
		this.display();
	}

	private async confirmDeleteStatus(status: string): Promise<void> {
		const confirmed = await confirmDelete(this.app, {
			title: "Delete status",
			message: `Delete "${status}"? This removes the status from controls and board columns. Notes already using this status keep their value.`,
			confirmText: "Delete status",
		});

		if (confirmed) {
			await this.deleteStatus(status);
		}
	}

	private async deleteStatus(status: string): Promise<void> {
		this.plugin.settings.statusOptions = this.plugin.settings.statusOptions.filter((candidate) => candidate !== status);
		this.plugin.settings.boardColumnOrder = this.plugin.settings.boardColumnOrder.filter((candidate) => candidate !== status);
		this.plugin.settings.collapsedBoardColumns = this.plugin.settings.collapsedBoardColumns.filter((candidate) => candidate !== status);
		delete this.plugin.settings.statusColors[status];
		await this.plugin.saveSettings();
		this.display();
	}

	private addHeading(containerEl: HTMLElement, name: string): void {
		new Setting(containerEl)
			.setName(name)
			.setHeading();
	}
}

interface DeleteConfirmationOptions {
	title: string;
	message: string;
	confirmText: string;
}

function confirmDelete(app: App, options: DeleteConfirmationOptions): Promise<boolean> {
	return new Promise((resolve) => {
		new DeleteConfirmationModal(app, options, resolve).open();
	});
}

class MarkdownFileSuggestModal extends SuggestModal<TFile> {
	private readonly files: TFile[];

	constructor(
		app: App,
		private readonly currentPath: string,
		private readonly onChoose: (file: TFile) => Promise<void>,
	) {
		super(app);
		this.files = app.vault.getMarkdownFiles();
		this.setPlaceholder("Choose a template file");
	}

	getSuggestions(query: string): TFile[] {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) {
			return this.files.slice(0, 50);
		}

		return this.files
			.filter((file) => file.path.toLowerCase().includes(normalizedQuery))
			.slice(0, 50);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		const suggestionEl = el.createDiv({cls: "spv-icon-suggestion"});
		suggestionEl.createSpan({cls: "spv-icon-suggestion-name", text: file.path});

		if (file.path === this.currentPath) {
			const currentEl = suggestionEl.createSpan({cls: "spv-icon-suggestion-current", text: "Current"});
			currentEl.setAttribute("aria-label", "Current template file");
		}
	}

	onChooseSuggestion(file: TFile): void {
		void this.onChoose(file);
	}
}

class DeleteConfirmationModal extends Modal {
	private didResolve = false;

	constructor(
		app: App,
		private readonly options: DeleteConfirmationOptions,
		private readonly resolve: (confirmed: boolean) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.options.title);
		this.contentEl.empty();
		this.contentEl.createEl("p", {text: this.options.message});

		const actionsEl = this.contentEl.createDiv({cls: "spv-modal-actions"});
		new ButtonComponent(actionsEl)
			.setButtonText("Cancel")
			.onClick(() => this.closeWithResult(false));

		new ButtonComponent(actionsEl)
			.setButtonText(this.options.confirmText)
			.setWarning()
			.onClick(() => this.closeWithResult(true));
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolveOnce(false);
	}

	private closeWithResult(confirmed: boolean): void {
		this.resolveOnce(confirmed);
		this.close();
	}

	private resolveOnce(confirmed: boolean): void {
		if (this.didResolve) {
			return;
		}

		this.didResolve = true;
		this.resolve(confirmed);
	}
}
