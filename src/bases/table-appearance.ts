import {getProjectPropertyDefinitionById} from "../project-properties";
import type {SimpleProjectViewsSettings} from "../settings";

export function normalizeShowTableColumnDividers(value: unknown): boolean {
	return value !== false;
}

export function getProjectTableClassName(showColumnDividers: boolean): string {
	return showColumnDividers
		? "spv-project-table spv-project-table-column-dividers"
		: "spv-project-table";
}

export function shouldUseReadOnlyProgressTableCell(
	settings: SimpleProjectViewsSettings,
	field: string,
	isEditing: boolean,
): boolean {
	const definition = getProjectPropertyDefinitionById(settings.projectProperties, field);

	return !isEditing && definition?.render === "progress";
}
