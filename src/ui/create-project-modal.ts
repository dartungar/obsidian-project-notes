import {ButtonComponent, Modal, Notice, Setting} from "obsidian";
import type SimpleProjectViewsPlugin from "../main";
import {isNumericProperty} from "../project-properties";
import type {ProjectPropertyDefinition, ProjectPropertyInputValue} from "../project-properties";
import type {ProjectCreationValues} from "../project-template";
import {ProjectIconSuggestModal} from "./icon-suggest-modal";

export class CreateProjectModal extends Modal {
	private values: ProjectCreationValues;
	private createButton: ButtonComponent | null = null;

	constructor(private readonly plugin: SimpleProjectViewsPlugin) {
		super(plugin.app);
		this.values = getDefaultProjectValues(plugin);
	}

	onOpen(): void {
		this.setTitle("Create project");
		this.contentEl.empty();
		this.contentEl.addClass("spv-create-project-modal");

		this.renderNameSetting();
		this.renderMetadataSettings();
		this.renderActions();
		this.updateCreateButton();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderNameSetting(): void {
		new Setting(this.contentEl)
			.setName("Project name")
			.addText((text) => {
				text
					.setPlaceholder("Project name")
					.setValue(this.values.title)
					.onChange((value) => {
						this.values.title = value;
						this.updateCreateButton();
					});
				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter" && this.values.title.trim()) {
						void this.createProject();
					}
				});
				requestAnimationFrame(() => text.inputEl.focus());
			});
	}

	private renderMetadataSettings(): void {
		const {settings} = this.plugin;

		new Setting(this.contentEl)
			.setName("Status")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "Unset");
				for (const status of settings.statusOptions) {
					dropdown.addOption(status, status);
				}
				dropdown
					.setValue(this.values.status)
					.onChange((value) => {
						this.values.status = value;
					});
			});

		if (settings.enabledProperties.icon && settings.propertyNames.icon.trim()) {
			this.addProjectIconSetting();
		}

		for (const property of settings.projectProperties) {
			if (property.name.trim()) {
				this.renderPropertySetting(property);
			}
		}
	}

	private renderPropertySetting(property: ProjectPropertyDefinition): void {
		if (property.render === "textarea") {
			this.addTextAreaSetting(property);
			return;
		}

		if (isNumericProperty(property)) {
			this.addNumberSetting(property);
			return;
		}

		this.addTextSetting(property);
	}

	private addProjectIconSetting(): void {
		new Setting(this.contentEl)
			.setName("Project icon")
			.addText((text) => {
				text
					.setPlaceholder("Icon name")
					.setValue(this.values.icon)
					.onChange((value) => {
						this.values.icon = value.trim();
					});
				text.inputEl.addClass("spv-create-project-icon-input");
			})
			.addExtraButton((button) => {
				button
					.setIcon("image")
					.setTooltip("Choose icon")
					.onClick(() => {
						const inputEl = this.contentEl.querySelector(".spv-create-project-icon-input");
						new ProjectIconSuggestModal(this.app, this.values.icon, (icon) => {
							this.values.icon = icon;
							if (inputEl instanceof HTMLInputElement) {
								inputEl.value = icon;
							}
							return Promise.resolve();
						}).open();
					});
			});
	}

	private addNumberSetting(property: ProjectPropertyDefinition): void {
		const value = this.getNumberValue(property);
		const valueEl = document.createElement("span");
		valueEl.addClass("spv-setting-value");
		valueEl.setText(String(value));

		new Setting(this.contentEl)
			.setName(property.label)
			.addSlider((slider) => {
				slider
					.setLimits(property.min, property.max, property.step)
					.setValue(value)
					.setDynamicTooltip()
					.onChange((nextValue) => {
						this.values.propertyValues[property.id] = nextValue;
						valueEl.setText(String(nextValue));
					});
			})
			.then((setting) => {
				setting.controlEl.prepend(valueEl);
			});
	}

	private addTextAreaSetting(property: ProjectPropertyDefinition): void {
		new Setting(this.contentEl)
			.setName(property.label)
			.addTextArea((text) => {
				text
					.setValue(this.getStringValue(property))
					.onChange((value) => {
						this.values.propertyValues[property.id] = value.trim().length > 0 ? value : null;
					});
				text.inputEl.rows = 3;
			});
	}

	private addTextSetting(property: ProjectPropertyDefinition): void {
		new Setting(this.contentEl)
			.setName(property.label)
			.addText((text) => {
				if (property.render === "date") {
					text.inputEl.type = "date";
				} else if (property.render === "datetime") {
					text.inputEl.type = "datetime-local";
				}

				text
					.setValue(this.getStringValue(property))
					.onChange((value) => {
						this.values.propertyValues[property.id] = value.trim() || null;
					});
			});
	}

	private getStringValue(property: ProjectPropertyDefinition): string {
		const value = this.values.propertyValues[property.id];
		return value === null || value === undefined ? "" : String(value);
	}

	private getNumberValue(property: ProjectPropertyDefinition): number {
		const value = this.values.propertyValues[property.id];
		const numberValue = typeof value === "number" ? value : Number.parseFloat(String(value));

		return Number.isFinite(numberValue) ? numberValue : property.min;
	}

	private renderActions(): void {
		const actionsEl = this.contentEl.createDiv({cls: "spv-modal-actions"});

		new ButtonComponent(actionsEl)
			.setButtonText("Cancel")
			.onClick(() => this.close());

		this.createButton = new ButtonComponent(actionsEl)
			.setButtonText("Create")
			.setCta()
			.onClick(() => {
				void this.createProject();
			});
	}

	private updateCreateButton(): void {
		this.createButton?.setDisabled(!this.values.title.trim());
	}

	private async createProject(): Promise<void> {
		if (!this.values.title.trim()) {
			new Notice("Enter a project name");
			return;
		}

		this.createButton?.setDisabled(true);
		try {
			await this.plugin.createProject(this.values);
			this.close();
		} catch (error) {
			console.error("Simple project views: could not create project", error);
			new Notice("Could not create project");
			this.updateCreateButton();
		}
	}
}

function getDefaultProjectValues(plugin: SimpleProjectViewsPlugin): ProjectCreationValues {
	const firstActiveStatus = plugin.settings.activeStatuses[0];
	const firstStatus = plugin.settings.statusOptions[0];
	const propertyValues: Record<string, ProjectPropertyInputValue> = {};

	for (const property of plugin.settings.projectProperties) {
		propertyValues[property.id] = getDefaultPropertyValue(property);
	}

	return {
		title: "",
		icon: "",
		status: firstActiveStatus ?? firstStatus ?? "",
		propertyValues,
	};
}

function getDefaultPropertyValue(property: ProjectPropertyDefinition): ProjectPropertyInputValue {
	if (property.render === "progress") {
		return property.min;
	}

	return null;
}
