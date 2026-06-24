import type {BasesPropertyId} from "obsidian";
import type {ProjectPropertyDefinition} from "../project-properties";
import type {ProjectControlField} from "../ui/project-controls";

export interface ProjectViewPropertySettings {
	enabledProperties: {
		icon: boolean;
	};
	propertyNames: {
		icon: string;
		status: string;
	};
	projectProperties: ProjectPropertyDefinition[];
}

export interface ProjectViewColumn {
	key: string;
	label: string;
	propertyId: BasesPropertyId;
	configPropertyId: string;
	field?: ProjectControlField;
}

export interface ResolvedProjectViewProperties {
	controlFields: ProjectControlField[];
	showTitleIcon: boolean;
	tableColumns: ProjectViewColumn[];
}

const FILE_NAME_PROPERTY_ID = "file.name" as BasesPropertyId;

export function resolveProjectViewProperties(
	settings: ProjectViewPropertySettings,
	propertyOrder: string[],
	getDisplayName: (propertyId: BasesPropertyId) => string,
): ResolvedProjectViewProperties {
	const supportedColumns = getSupportedColumns(settings);
	const configuredOrder = propertyOrder.length > 0 ? propertyOrder : [FILE_NAME_PROPERTY_ID];
	const tableColumns: ProjectViewColumn[] = [];
	const controlFields: ProjectControlField[] = [];
	const addedPropertyIds = new Set<string>();
	const addedFields = new Set<ProjectControlField>();

	for (const propertyId of configuredOrder) {
		const column = supportedColumns.get(propertyId);
		if (!column || addedPropertyIds.has(column.propertyId)) {
			continue;
		}

		tableColumns.push(withDisplayName(column, getDisplayName));
		addedPropertyIds.add(column.propertyId);
		if (column.field && !addedFields.has(column.field)) {
			controlFields.push(column.field);
			addedFields.add(column.field);
		}
	}

	if (propertyOrder.length === 0 && !addedPropertyIds.has(FILE_NAME_PROPERTY_ID)) {
		const titleColumn = supportedColumns.get(FILE_NAME_PROPERTY_ID);
		if (titleColumn) {
			tableColumns.unshift(withDisplayName(titleColumn, getDisplayName));
		}
	}

	return {
		controlFields,
		showTitleIcon: addedFields.has("icon"),
		tableColumns,
	};
}

export function getNotePropertyId(propertyName: string): BasesPropertyId {
	return `note.${propertyName}` as BasesPropertyId;
}

function getSupportedColumns(settings: ProjectViewPropertySettings): Map<string, ProjectViewColumn> {
	const columns = new Map<string, ProjectViewColumn>();
	addColumn(columns, {
		key: "title",
		label: "Project",
		propertyId: FILE_NAME_PROPERTY_ID,
		configPropertyId: FILE_NAME_PROPERTY_ID,
	});

	if (settings.enabledProperties.icon && settings.propertyNames.icon.trim()) {
		addColumn(columns, {
			key: "icon",
			label: "Icon",
			field: "icon",
			propertyId: getNotePropertyId(settings.propertyNames.icon),
			configPropertyId: settings.propertyNames.icon,
		});
	}

	if (settings.propertyNames.status.trim()) {
		addColumn(columns, {
			key: "status",
			label: "Status",
			field: "status",
			propertyId: getNotePropertyId(settings.propertyNames.status),
			configPropertyId: settings.propertyNames.status,
		});
	}

	for (const property of settings.projectProperties) {
		if (!property.name.trim()) {
			continue;
		}

		addColumn(columns, {
			key: property.id,
			label: property.label,
			field: property.id,
			propertyId: getNotePropertyId(property.name),
			configPropertyId: property.name,
		});
	}

	return columns;
}

function addColumn(columns: Map<string, ProjectViewColumn>, column: ProjectViewColumn): void {
	if (!columns.has(column.propertyId)) {
		columns.set(column.propertyId, column);
	}
	if (!columns.has(column.configPropertyId)) {
		columns.set(column.configPropertyId, column);
	}
}

function withDisplayName(
	column: ProjectViewColumn,
	getDisplayName: (propertyId: BasesPropertyId) => string,
): ProjectViewColumn {
	return {
		...column,
		label: getDisplayName(column.propertyId) || column.label,
	};
}
