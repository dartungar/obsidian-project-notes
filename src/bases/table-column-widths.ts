import type {BasesPropertyId} from "obsidian";

export type TableColumnWidths = Record<string, number>;

export const MIN_TABLE_COLUMN_WIDTH = 80;

export function normalizeTableColumnWidths(
	value: unknown,
	propertyIds: BasesPropertyId[],
): TableColumnWidths {
	if (!isRecord(value)) {
		return {};
	}

	const allowedPropertyIds = new Set<string>(propertyIds);
	const widths: TableColumnWidths = {};
	for (const propertyId of propertyIds) {
		if (!allowedPropertyIds.has(propertyId)) {
			continue;
		}

		const width = readFiniteNumber(value[propertyId]);
		if (width !== null) {
			widths[propertyId] = normalizeTableColumnWidth(width);
		}
	}

	return widths;
}

export function setTableColumnWidth(
	widths: TableColumnWidths,
	propertyId: BasesPropertyId,
	width: number,
): TableColumnWidths {
	return {
		...widths,
		[propertyId]: normalizeTableColumnWidth(width),
	};
}

export function resetTableColumnWidth(
	widths: TableColumnWidths,
	propertyId: BasesPropertyId,
): TableColumnWidths {
	const nextWidths = {...widths};
	delete nextWidths[propertyId];

	return nextWidths;
}

function normalizeTableColumnWidth(width: number): number {
	return Math.max(MIN_TABLE_COLUMN_WIDTH, Math.round(width));
}

function readFiniteNumber(value: unknown): number | null {
	const numberValue = typeof value === "number" ? value : Number.parseFloat(String(value));

	return Number.isFinite(numberValue) ? numberValue : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
