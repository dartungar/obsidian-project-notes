import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import type SimpleProjectViewsPlugin from "./main";
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

export type ProjectCriteriaMode = "any" | "all";
export type ProjectToolbarPosition = "top" | "bottom" | "left" | "right";
type SettingsTabId = "general" | "views" | "noteBar" | "statuses" | "properties";

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

export type ProjectPropertyKey = keyof ProjectPropertyNames;
export type ToggleableProjectPropertyKey = Exclude<ProjectPropertyKey, "status">;

export type ProjectPropertyToggles = Record<ToggleableProjectPropertyKey, boolean>;

export interface SimpleProjectViewsSettings {
	criteriaMode: ProjectCriteriaMode;
	projectTag: string;
	projectPropertyName: string;
	projectPropertyValue: string;
	projectFolder: string;
	propertyNames: ProjectPropertyNames;
	enabledProperties: ProjectPropertyToggles;
	projectProperties: ProjectPropertyDefinition[];
	statusOptions: string[];
	statusColors: Record<string, string>;
	activeStatuses: string[];
	showProjectToolbar: boolean;
	noteToolbarPosition: ProjectToolbarPosition;
	projectCreationPathTemplate: string;
	projectCreationTemplate: string;
	baseFilePath: string;
	boardColumnWidth: number;
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
	criteriaMode: "any",
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
	activeStatuses: ["todo", "in-progress", "blocked"],
	showProjectToolbar: true,
	noteToolbarPosition: "top",
	projectCreationPathTemplate: "Projects/{{safe_title}}.md",
	projectCreationTemplate: DEFAULT_PROJECT_CREATION_TEMPLATE,
	baseFilePath: "Project views.base",
	boardColumnWidth: 280,
	boardColumnOrder: [],
	boardCardOrder: [],
	collapsedBoardColumns: [],
};

const EXAMPLE_PROJECT_PROPERTY_NAME = "type";
const EXAMPLE_PROJECT_PROPERTY_VALUE = "project";
const EXAMPLE_NEW_STATUS = "waiting";
const FALLBACK_STATUS_COLOR = "#8a8a8a";

const TAB_LABELS: Record<SettingsTabId, string> = {
	general: "General",
	views: "Views",
	noteBar: "Note bar",
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
	const propertyNames = {
		...DEFAULT_SETTINGS.propertyNames,
		...(settings.propertyNames ?? {}),
	};
	const enabledProperties = {
		...DEFAULT_SETTINGS.enabledProperties,
		...(settings.enabledProperties ?? {}),
	};
	const projectProperties = Array.isArray(settings.projectProperties)
		? normalizeProjectPropertyDefinitions(settings.projectProperties)
		: migrateLegacyProjectProperties(propertyNames, enabledProperties);
	const statusOptions = normalizeStatusOptions(settings.statusOptions);
	const activeStatuses = normalizeStatusOptions(settings.activeStatuses).filter((status) => statusOptions.includes(status));

	return {
		...DEFAULT_SETTINGS,
		...settings,
		propertyNames,
		enabledProperties,
		projectProperties,
		statusOptions,
		statusColors: normalizeStatusColors(settings.statusColors, statusOptions),
		activeStatuses,
		noteToolbarPosition: normalizeProjectToolbarPosition(settings.noteToolbarPosition),
		projectCreationPathTemplate: normalizeProjectCreationPathTemplate(settings.projectCreationPathTemplate),
		projectCreationTemplate: typeof settings.projectCreationTemplate === "string" ? settings.projectCreationTemplate : DEFAULT_SETTINGS.projectCreationTemplate,
		boardColumnWidth: normalizeBoardColumnWidth(settings.boardColumnWidth),
		boardColumnOrder: settings.boardColumnOrder ?? DEFAULT_SETTINGS.boardColumnOrder,
		boardCardOrder: normalizeBoardCardOrder(settings.boardCardOrder),
		collapsedBoardColumns: settings.collapsedBoardColumns ?? DEFAULT_SETTINGS.collapsedBoardColumns,
	};
}

export function normalizeBoardColumnWidth(value: unknown): number {
	const numericValue = typeof value === "number" ? value : Number.parseInt(String(value), 10);
	if (!Number.isFinite(numericValue)) {
		return DEFAULT_SETTINGS.boardColumnWidth;
	}

	return Math.max(MIN_BOARD_COLUMN_WIDTH, Math.min(MAX_BOARD_COLUMN_WIDTH, numericValue));
}

function normalizeBoardCardOrder(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return unique(value
		.filter((path): path is string => typeof path === "string")
		.map((path) => path.trim())
		.filter((path) => path.length > 0));
}

export function isProjectPropertyEnabled(settings: SimpleProjectViewsSettings, property: ProjectPropertyKey): boolean {
	return property === "status" || settings.enabledProperties[property];
}

export function getStatusColor(settings: SimpleProjectViewsSettings, status: string): string {
	return settings.statusColors[status] ?? DEFAULT_SETTINGS.statusColors[status] ?? FALLBACK_STATUS_COLOR;
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

export function normalizeProjectToolbarPosition(value: unknown): ProjectToolbarPosition {
	return value === "top" || value === "bottom" || value === "left" || value === "right" ? value : DEFAULT_SETTINGS.noteToolbarPosition;
}

function normalizeProjectCreationPathTemplate(value: unknown): string {
	if (typeof value !== "string" || !value.trim()) {
		return DEFAULT_SETTINGS.projectCreationPathTemplate;
	}

	return value.trim().replace(/^\/+/, "");
}

function normalizeStatusOptions(statusOptions: string[] | undefined): string[] {
	const normalizedOptions = unique((Array.isArray(statusOptions) ? statusOptions : DEFAULT_SETTINGS.statusOptions)
		.map((status) => status.trim())
		.filter((status) => status.length > 0));

	return normalizedOptions;
}

function normalizeStatusColors(statusColors: Record<string, string> | undefined, statusOptions: string[]): Record<string, string> {
	const normalizedColors: Record<string, string> = {};

	for (const status of statusOptions) {
		normalizedColors[status] = normalizeStatusColor(statusColors?.[status] ?? DEFAULT_SETTINGS.statusColors[status]);
	}

	return normalizedColors;
}

function normalizeStatusColor(value: string | undefined): string {
	if (value && /^#[0-9a-f]{6}$/i.test(value)) {
		return value;
	}

	return FALLBACK_STATUS_COLOR;
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

export class SimpleProjectViewsSettingTab extends PluginSettingTab {
	plugin: SimpleProjectViewsPlugin;
	private activeTab: SettingsTabId = "general";

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
			.setName("Match mode")
			.setDesc("Choose whether a note must match any configured criterion or all configured criteria.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("any", "Any criterion")
					.addOption("all", "All criteria")
					.setValue(this.plugin.settings.criteriaMode)
					.onChange(async (value) => {
						this.plugin.settings.criteriaMode = value as ProjectCriteriaMode;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Project tag")
			.setDesc("Notes with this tag are projects. Use the tag name without #.")
			.addText((text) => {
				text
					.setPlaceholder(DEFAULT_SETTINGS.projectTag)
					.setValue(this.plugin.settings.projectTag)
					.onChange(async (value) => {
						this.plugin.settings.projectTag = value.trim().replace(/^#/, "");
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Project property")
			.setDesc("Optional property that marks a project note.")
			.addText((text) => {
				text
					.setPlaceholder(EXAMPLE_PROJECT_PROPERTY_NAME)
					.setValue(this.plugin.settings.projectPropertyName)
					.onChange(async (value) => {
						this.plugin.settings.projectPropertyName = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Project property value")
			.setDesc("Leave empty to match any non-empty value for the project property.")
			.addText((text) => {
				text
					.setPlaceholder(EXAMPLE_PROJECT_PROPERTY_VALUE)
					.setValue(this.plugin.settings.projectPropertyValue)
					.onChange(async (value) => {
						this.plugin.settings.projectPropertyValue = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Project folder")
			.setDesc("Optional folder prefix for project notes.")
			.addText((text) => {
				text
					.setPlaceholder("Projects")
					.setValue(this.plugin.settings.projectFolder)
					.onChange(async (value) => {
						this.plugin.settings.projectFolder = value.trim().replace(/^\/+|\/+$/g, "");
						await this.plugin.saveSettings();
					});
			});

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
			.setDesc("Markdown template used by the create project command.")
			.addTextArea((text) => {
				text
					.setPlaceholder(DEFAULT_PROJECT_CREATION_TEMPLATE)
					.setValue(this.plugin.settings.projectCreationTemplate)
					.onChange(async (value) => {
						this.plugin.settings.projectCreationTemplate = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 10;
				text.inputEl.addClass("spv-template-textarea");
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

	private displayStatuses(containerEl: HTMLElement): void {
		this.addHeading(containerEl, "Statuses");

		for (let index = 0; index < this.plugin.settings.statusOptions.length; index += 1) {
			const status = this.plugin.settings.statusOptions[index];
			if (status) {
				this.addStatusSetting(containerEl, status, index);
			}
		}

		this.addNewStatusSetting(containerEl);
	}

	private addStatusSetting(containerEl: HTMLElement, status: string, index: number): void {
		new Setting(containerEl)
			.setName(status)
			.setDesc("Available in project controls. Current statuses appear in the side pane.")
			.setClass("spv-status-setting")
			.addText((text) => {
				text
					.setValue(status)
					.setPlaceholder(DEFAULT_SETTINGS.propertyNames.status);
				text.inputEl.addEventListener("blur", () => {
					void this.renameStatus(index, status, text.getValue());
				});
				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						text.inputEl.blur();
					}
				});
			})
			.addColorPicker((color) => {
				color
					.setValue(getStatusColor(this.plugin.settings, status))
					.onChange(async (value) => {
						this.plugin.settings.statusColors[status] = normalizeStatusColor(value);
						await this.plugin.saveSettings();
					});
			})
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.activeStatuses.includes(status))
					.onChange(async (value) => {
						this.setStatusCurrent(status, value);
						await this.plugin.saveSettings();
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("arrow-up")
					.setTooltip("Move up")
					.setDisabled(index === 0)
					.onClick(async () => {
						await this.moveStatus(index, index - 1);
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("arrow-down")
					.setTooltip("Move down")
					.setDisabled(index === this.plugin.settings.statusOptions.length - 1)
					.onClick(async () => {
						await this.moveStatus(index, index + 1);
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("trash")
					.setTooltip("Delete status")
					.onClick(async () => {
						await this.deleteStatus(status);
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

		this.addStatusPropertySetting(containerEl);
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
			.setName("Status property")
			.setDesc("Status stays special because it drives current projects and board columns.")
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

		new Setting(containerEl)
			.setName(title)
			.setDesc(desc)
			.setHeading()
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
						await this.deleteProjectProperty(index);
					});
			});

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
						this.plugin.settings.projectProperties = [
							...this.plugin.settings.projectProperties,
							createProjectPropertyDefinition(this.plugin.settings.projectProperties),
						];
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

	private async deleteProjectProperty(index: number): Promise<void> {
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
		this.plugin.settings.activeStatuses = [...this.plugin.settings.activeStatuses, status];
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

		const statusOptions = [...this.plugin.settings.statusOptions];
		statusOptions[index] = nextStatus;
		this.plugin.settings.statusOptions = statusOptions;
		this.plugin.settings.activeStatuses = this.plugin.settings.activeStatuses.map((status) => status === oldStatus ? nextStatus : status);
		this.plugin.settings.boardColumnOrder = this.plugin.settings.boardColumnOrder.map((status) => status === oldStatus ? nextStatus : status);
		this.plugin.settings.collapsedBoardColumns = this.plugin.settings.collapsedBoardColumns.map((status) => status === oldStatus ? nextStatus : status);
		this.plugin.settings.statusColors[nextStatus] = getStatusColor(this.plugin.settings, oldStatus);
		delete this.plugin.settings.statusColors[oldStatus];

		await this.plugin.saveSettings();
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

	private async deleteStatus(status: string): Promise<void> {
		this.plugin.settings.statusOptions = this.plugin.settings.statusOptions.filter((candidate) => candidate !== status);
		this.plugin.settings.activeStatuses = this.plugin.settings.activeStatuses.filter((candidate) => candidate !== status);
		this.plugin.settings.boardColumnOrder = this.plugin.settings.boardColumnOrder.filter((candidate) => candidate !== status);
		this.plugin.settings.collapsedBoardColumns = this.plugin.settings.collapsedBoardColumns.filter((candidate) => candidate !== status);
		delete this.plugin.settings.statusColors[status];
		await this.plugin.saveSettings();
		this.display();
	}

	private setStatusCurrent(status: string, isCurrent: boolean): void {
		if (isCurrent) {
			if (!this.plugin.settings.activeStatuses.includes(status)) {
				this.plugin.settings.activeStatuses = [...this.plugin.settings.activeStatuses, status];
			}
			return;
		}

		this.plugin.settings.activeStatuses = this.plugin.settings.activeStatuses.filter((candidate) => candidate !== status);
	}

	private addHeading(containerEl: HTMLElement, name: string): void {
		new Setting(containerEl)
			.setName(name)
			.setHeading();
	}
}
