import type {BasesSortConfig} from "obsidian";
import type {ProjectInfo} from "../project-metadata";
import type {ProjectViewColumn} from "./view-properties";

export const BASES_ORDER_CONFIG_KEY = "order";
export const BASES_SORT_CONFIG_KEY = "sort";

export type BasesSortDirection = BasesSortConfig["direction"];
export type BasesSortPropertyDirection = BasesSortDirection | "TOGGLE" | "NONE";
export interface BasesWritableSortConfig {
	property: string;
	direction: BasesSortDirection;
}

export type BasesPropertySelector = string | readonly string[];

interface NativeBasesSortConfig {
	setSortProperty: (property: string, direction: BasesSortPropertyDirection) => void;
}

interface NativeBasesOrderConfig {
	setOrder: (order: string[]) => void;
}

export function getColumnSort<TSort extends BasesWritableSortConfig>(
	sorts: TSort[],
	propertyIds: BasesPropertySelector,
): TSort | null {
	const propertyIdSet = getPropertyIdSet(propertyIds);
	return sorts.find((sort) => propertyIdSet.has(sort.property)) ?? null;
}

export function getNextColumnSortDirection(
	sorts: BasesWritableSortConfig[],
	propertyIds: BasesPropertySelector,
): BasesSortDirection {
	return getColumnSort(sorts, propertyIds)?.direction === "ASC" ? "DESC" : "ASC";
}

export function hideColumnFromOrder(
	propertyOrder: string[],
	propertyIds: BasesPropertySelector,
): string[] {
	const propertyIdSet = getPropertyIdSet(propertyIds);
	return propertyOrder.filter((candidate) => !propertyIdSet.has(candidate));
}

export function setBasesSortProperty(
	config: unknown,
	propertyId: string,
	direction: BasesSortPropertyDirection,
): boolean {
	if (!hasNativeBasesSortConfig(config)) {
		return false;
	}

	config.setSortProperty(propertyId, direction);
	return true;
}

export function setBasesPropertyOrder(
	config: unknown,
	propertyOrder: string[],
): boolean {
	if (!hasNativeBasesOrderConfig(config)) {
		return false;
	}

	config.setOrder(propertyOrder);
	return true;
}

export function normalizeTableSorts(
	sorts: BasesWritableSortConfig[],
	columns: ProjectViewColumn[],
): BasesWritableSortConfig[] {
	return sorts.map((sort) => ({
		...sort,
		property: normalizeTablePropertyId(sort.property, columns),
	}));
}

export function normalizeTablePropertyOrder(
	propertyOrder: string[],
	columns: ProjectViewColumn[],
): string[] {
	return propertyOrder.map((propertyId) => normalizeTablePropertyId(propertyId, columns));
}

export function sortProjectsByTableSort(
	projects: ProjectInfo[],
	columns: ProjectViewColumn[],
	sorts: BasesWritableSortConfig[],
): ProjectInfo[] {
	const resolvedSorts = sorts
		.map((sort) => ({
			...sort,
			column: getColumnForSort(columns, sort.property),
		}))
		.filter((sort): sort is BasesWritableSortConfig & {column: ProjectViewColumn} => sort.column !== null);

	if (resolvedSorts.length === 0) {
		return projects;
	}

	return [...projects].sort((first, second) => {
		for (const sort of resolvedSorts) {
			const comparison = compareSortValues(
				getProjectColumnSortValue(first, sort.column),
				getProjectColumnSortValue(second, sort.column),
			);
			if (comparison !== 0) {
				return sort.direction === "ASC" ? comparison : comparison * -1;
			}
		}

		return compareProjectFallback(first, second);
	});
}

function getColumnForSort(columns: ProjectViewColumn[], propertyId: string): ProjectViewColumn | null {
	return columns.find((column) => column.propertyId === propertyId || column.configPropertyId === propertyId) ?? null;
}

function hasNativeBasesSortConfig(config: unknown): config is NativeBasesSortConfig {
	return !!config
		&& typeof config === "object"
		&& "setSortProperty" in config
		&& typeof config.setSortProperty === "function";
}

function hasNativeBasesOrderConfig(config: unknown): config is NativeBasesOrderConfig {
	return !!config
		&& typeof config === "object"
		&& "setOrder" in config
		&& typeof config.setOrder === "function";
}

function normalizeTablePropertyId(propertyId: string, columns: ProjectViewColumn[]): string {
	const column = getColumnForSort(columns, propertyId);
	if (column) {
		return column.propertyId;
	}

	return propertyId.includes(".") ? propertyId : `note.${propertyId}`;
}

function getProjectColumnSortValue(project: ProjectInfo, column: ProjectViewColumn): string | number | null {
	if (column.key === "title") {
		return project.title;
	}

	if (column.field === "icon") {
		return project.icon;
	}

	if (column.field === "status") {
		return project.status;
	}

	if (!column.field) {
		return null;
	}

	const property = project.properties.find((candidate) => candidate.definition.id === column.field);
	if (!property) {
		return null;
	}

	return property.numberValue ?? property.value;
}

function compareSortValues(first: string | number | null, second: string | number | null): number {
	const firstEmpty = first === null || first === "";
	const secondEmpty = second === null || second === "";
	if (firstEmpty || secondEmpty) {
		if (firstEmpty && secondEmpty) {
			return 0;
		}

		return firstEmpty ? 1 : -1;
	}

	if (typeof first === "number" && typeof second === "number") {
		return first - second;
	}

	return String(first).localeCompare(String(second));
}

function compareProjectFallback(first: ProjectInfo, second: ProjectInfo): number {
	return first.title.localeCompare(second.title) || first.file.path.localeCompare(second.file.path);
}

function getPropertyIdSet(propertyIds: BasesPropertySelector): Set<string> {
	const values = typeof propertyIds === "string" ? [propertyIds] : [...propertyIds];
	return new Set(values);
}
