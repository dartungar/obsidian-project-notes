export class App {
}

export class ButtonComponent {
	constructor(_containerEl?: HTMLElement) {
	}

	setButtonText(_text: string): this {
		return this;
	}

	setCta(): this {
		return this;
	}

	setDisabled(_disabled: boolean): this {
		return this;
	}

	onClick(_callback: () => void): this {
		return this;
	}
}

export class Modal {
	contentEl = createElement();

	constructor(public app: App) {
	}

	setTitle(_title: string): void {
	}

	open(): void {
	}

	close(): void {
	}
}

export class Notice {
	constructor(_message: string) {
	}
}

export class PluginSettingTab {
	containerEl = createElement();

	constructor(public app: App, _plugin: unknown) {
	}

	display(): void {
	}
}

export class Setting {
	controlEl = createElement();

	constructor(_containerEl: HTMLElement) {
	}

	setName(_name: string): this {
		return this;
	}

	setDesc(_desc: string): this {
		return this;
	}

	setHeading(): this {
		return this;
	}

	setClass(_className: string): this {
		return this;
	}

	addText(_callback: (component: TextComponent) => void): this {
		return this;
	}

	addTextArea(_callback: (component: TextAreaComponent) => void): this {
		return this;
	}

	addSearch(_callback: (component: TextComponent) => void): this {
		return this;
	}

	addDropdown(_callback: (component: DropdownComponent) => void): this {
		return this;
	}

	addToggle(_callback: (component: ToggleComponent) => void): this {
		return this;
	}

	addSlider(_callback: (component: SliderComponent) => void): this {
		return this;
	}

	addColorPicker(_callback: (component: ColorComponent) => void): this {
		return this;
	}

	addExtraButton(_callback: (component: ExtraButtonComponent) => void): this {
		return this;
	}

	addButton(_callback: (component: ButtonComponent) => void): this {
		return this;
	}

	then(callback: (setting: this) => void): this {
		callback(this);
		return this;
	}
}

export class SuggestModal<T> {
	inputEl = createInputElement();

	constructor(public app: App) {
	}

	open(): void {
	}

	close(): void {
	}

	setPlaceholder(_placeholder: string): void {
	}

	getSuggestions(_query: string): T[] | Promise<T[]> {
		return [];
	}

	renderSuggestion(_value: T, _el: HTMLElement): void {
	}

	onChooseSuggestion(_value: T): void {
	}
}

export class TFile {
	path = "";
	basename = "";
}

export class BasesView {
}

export class Menu {
	addItem(_callback: (item: MenuItem) => void): this {
		return this;
	}

	showAtMouseEvent(_event: MouseEvent): void {
	}
}

export class MenuItem {
	setTitle(_title: string): this {
		return this;
	}

	setIcon(_icon: string): this {
		return this;
	}

	onClick(_callback: () => void): this {
		return this;
	}
}

export class QueryController {
}

export interface CachedMetadata {
	frontmatter?: Record<string, unknown>;
}

export const editorInfoField = {};
export const editorLivePreviewField = {};

export function getAllTags(_cache: CachedMetadata): string[] {
	return [];
}

export function getIconIds(): string[] {
	return [];
}

export function setIcon(_el: HTMLElement, _icon: string): void {
}

export function setTooltip(_el: HTMLElement, _tooltip: string, _options?: unknown): void {
}

export function parseLinktext(linktext: string): {path: string; subpath: string} {
	const hashIndex = linktext.indexOf("#");
	if (hashIndex === -1) {
		return {path: linktext, subpath: ""};
	}

	return {
		path: linktext.slice(0, hashIndex),
		subpath: linktext.slice(hashIndex),
	};
}

function createElement(): HTMLElement {
	return {} as HTMLElement;
}

type TextInputElement = HTMLInputElement | HTMLTextAreaElement;

function createInputElement(): TextInputElement {
	return {} as TextInputElement;
}

class TextComponent {
	inputEl: TextInputElement = createInputElement();

	setPlaceholder(_placeholder: string): this {
		return this;
	}

	setValue(_value: string): this {
		return this;
	}

	setDisabled(_disabled: boolean): this {
		return this;
	}

	onChange(_callback: (value: string) => void | Promise<void>): this {
		return this;
	}

	getValue(): string {
		return "";
	}
}

class TextAreaComponent extends TextComponent {
	inputEl: TextInputElement = {} as HTMLTextAreaElement;
}

class DropdownComponent {
	addOption(_value: string, _display: string): this {
		return this;
	}

	setValue(_value: string): this {
		return this;
	}

	onChange(_callback: (value: string) => void | Promise<void>): this {
		return this;
	}
}

class ToggleComponent {
	setValue(_value: boolean): this {
		return this;
	}

	onChange(_callback: (value: boolean) => void | Promise<void>): this {
		return this;
	}
}

class SliderComponent {
	setLimits(_min: number, _max: number, _step: number): this {
		return this;
	}

	setValue(_value: number): this {
		return this;
	}

	setDynamicTooltip(): this {
		return this;
	}

	onChange(_callback: (value: number) => void | Promise<void>): this {
		return this;
	}
}

class ColorComponent {
	setValue(_value: string): this {
		return this;
	}

	onChange(_callback: (value: string) => void | Promise<void>): this {
		return this;
	}
}

class ExtraButtonComponent {
	setIcon(_icon: string): this {
		return this;
	}

	setTooltip(_tooltip: string): this {
		return this;
	}

	setDisabled(_disabled: boolean): this {
		return this;
	}

	onClick(_callback: () => void | Promise<void>): this {
		return this;
	}
}
