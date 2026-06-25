import type {ProjectPropertyInputValue} from "./project-properties";

interface EditableYamlBlock {
	start: number;
	body: string;
	bodyStart: number;
	bodyEnd: number;
	end: number;
}

const BYTE_ORDER_MARK = "\ufeff";

export function updatePropertyInMarkdown(content: string, propertyName: string, value: ProjectPropertyInputValue): string {
	const frontmatters = getTopEditableYamlGroup(content);

	if (frontmatters.length === 0) {
		const body = updateYamlScalar("", propertyName, value);
		if (!body) {
			return content;
		}

		const documentStart = getDocumentStart(content);
		return `${content.slice(0, documentStart)}---\n${body}\n---\n${content.slice(documentStart)}`;
	}

	const firstFrontmatter = frontmatters[0]!;
	const targetFrontmatter = frontmatters[frontmatters.length - 1]!;
	const preservedOpening = content.slice(targetFrontmatter.start, targetFrontmatter.bodyStart);
	const mergedBody = mergeSimpleYamlScalars(
		frontmatters.slice(0, -1).map((frontmatter) => frontmatter.body),
		targetFrontmatter.body,
	);
	const nextBody = updateYamlScalar(mergedBody, propertyName, value);

	return `${content.slice(0, firstFrontmatter.start)}${preservedOpening}${nextBody}${content.slice(targetFrontmatter.bodyEnd)}`;
}

export function appendPropertyListItemInMarkdown(content: string, propertyName: string, value: string): string {
	const trimmedValue = value.trim();
	if (!propertyName.trim() || !trimmedValue) {
		return content;
	}

	const frontmatters = getTopEditableYamlGroup(content);

	if (frontmatters.length === 0) {
		const body = appendYamlListItem("", propertyName, trimmedValue);
		const documentStart = getDocumentStart(content);
		return `${content.slice(0, documentStart)}---\n${body}\n---\n${content.slice(documentStart)}`;
	}

	const firstFrontmatter = frontmatters[0]!;
	const targetFrontmatter = frontmatters[frontmatters.length - 1]!;
	const preservedOpening = content.slice(targetFrontmatter.start, targetFrontmatter.bodyStart);
	const mergedBody = mergeSimpleYamlScalars(
		frontmatters.slice(0, -1).map((frontmatter) => frontmatter.body),
		targetFrontmatter.body,
	);
	const nextBody = appendYamlListItem(mergedBody, propertyName, trimmedValue);

	return `${content.slice(0, firstFrontmatter.start)}${preservedOpening}${nextBody}${content.slice(targetFrontmatter.bodyEnd)}`;
}

export function repairDuplicateYamlBlocks(content: string): string {
	const frontmatters = getTopEditableYamlGroup(content);
	if (frontmatters.length < 2) {
		return content;
	}

	const firstFrontmatter = frontmatters[0]!;
	const targetFrontmatter = frontmatters[frontmatters.length - 1]!;
	const preservedOpening = content.slice(targetFrontmatter.start, targetFrontmatter.bodyStart);
	const mergedBody = mergeSimpleYamlScalars(
		frontmatters.slice(0, -1).map((frontmatter) => frontmatter.body),
		targetFrontmatter.body,
	);

	return `${content.slice(0, firstFrontmatter.start)}${preservedOpening}${mergedBody}${content.slice(targetFrontmatter.bodyEnd)}`;
}

function getTopEditableYamlGroup(content: string): EditableYamlBlock[] {
	const firstBlock = readYamlBlockAt(content, getDocumentStart(content));
	if (!firstBlock) {
		return [];
	}

	const group = [firstBlock];
	let offset = firstBlock.end;
	while (offset < content.length) {
		const whitespaceLength = /^[ \t\r\n]*/.exec(content.slice(offset))?.[0].length ?? 0;
		const nextBlock = readYamlBlockAt(content, offset + whitespaceLength);
		if (!nextBlock) {
			break;
		}

		group.push(nextBlock);
		offset = nextBlock.end;
	}

	return group;
}

function readYamlBlockAt(content: string, start: number): EditableYamlBlock | null {
	const openMatch = /^---[ \t]*(?:\r?\n)/.exec(content.slice(start));
	if (!openMatch) {
		return null;
	}

	const bodyStart = start + openMatch[0].length;
	const closePattern = /\r?\n---[ \t]*(?=\r?\n|$)/g;
	closePattern.lastIndex = bodyStart;
	const closeMatch = closePattern.exec(content);
	if (!closeMatch) {
		return null;
	}

	const bodyEnd = closeMatch.index;
	const body = content.slice(bodyStart, bodyEnd);
	let end = closeMatch.index + closeMatch[0].length;
	if (content.slice(end, end + 2) === "\r\n") {
		end += 2;
	} else if (content[end] === "\n") {
		end += 1;
	}

	return {
		start,
		body,
		bodyStart,
		bodyEnd,
		end,
	};
}

function getDocumentStart(content: string): number {
	return content.startsWith(BYTE_ORDER_MARK) ? BYTE_ORDER_MARK.length : 0;
}

function mergeSimpleYamlScalars(sourceBodies: string[], targetBody: string): string {
	let mergedBody = targetBody;

	for (const sourceBody of sourceBodies) {
		const sourceLines = sourceBody.split(/\r?\n/);
		for (let index = 0; index < sourceLines.length; index += 1) {
			const line = sourceLines[index] ?? "";
			const key = getYamlLineKey(line);
			if (!key || !isYamlKeyLine(line, key) || isYamlPropertyNested(sourceLines, index)) {
				continue;
			}

			if (!hasYamlKey(mergedBody, key)) {
				mergedBody = appendYamlLine(mergedBody, line);
			}
		}
	}

	return mergedBody;
}

function isYamlPropertyNested(lines: string[], index: number): boolean {
	const nextLine = lines[index + 1];

	return nextLine !== undefined && (nextLine.startsWith(" ") || nextLine.startsWith("\t"));
}

function hasYamlKey(body: string, propertyName: string): boolean {
	return body.split(/\r?\n/).some((line) => isYamlKeyLine(line, propertyName));
}

function appendYamlLine(body: string, line: string): string {
	if (!body) {
		return line;
	}

	const lineEnd = body.includes("\r\n") ? "\r\n" : "\n";
	return `${body}${lineEnd}${line}`;
}

function updateYamlScalar(body: string, propertyName: string, value: string | number | null): string {
	const lines = body.length ? body.split(/\r?\n/) : [];
	const lineEnd = body.includes("\r\n") ? "\r\n" : "\n";
	const keyIndex = lines.findIndex((line) => isYamlKeyLine(line, propertyName));
	const shouldDelete = value === null || value === "";

	if (keyIndex !== -1) {
		const replaceEnd = findYamlPropertyEnd(lines, keyIndex);
		if (shouldDelete) {
			lines.splice(keyIndex, replaceEnd - keyIndex);
		} else {
			lines.splice(keyIndex, replaceEnd - keyIndex, `${formatYamlKey(propertyName)}: ${formatYamlScalar(value)}`);
		}

		return lines.join(lineEnd);
	}

	if (shouldDelete) {
		return body;
	}

	lines.push(`${formatYamlKey(propertyName)}: ${formatYamlScalar(value)}`);
	return lines.join(lineEnd);
}

function appendYamlListItem(body: string, propertyName: string, value: string): string {
	const lines = body.length ? body.split(/\r?\n/) : [];
	const lineEnd = body.includes("\r\n") ? "\r\n" : "\n";
	const keyIndex = lines.findIndex((line) => isYamlKeyLine(line, propertyName));

	if (keyIndex === -1) {
		lines.push(...formatYamlListProperty(propertyName, [value]));
		return lines.join(lineEnd);
	}

	const replaceEnd = findYamlPropertyEnd(lines, keyIndex);
	const existingValues = readYamlPropertyValues(lines, keyIndex, replaceEnd);
	const values = appendUniqueYamlValue(existingValues, value);
	if (values.length === existingValues.length && isYamlListProperty(lines, keyIndex, replaceEnd)) {
		return body;
	}

	lines.splice(keyIndex, replaceEnd - keyIndex, ...formatYamlListProperty(propertyName, values));
	return lines.join(lineEnd);
}

function readYamlPropertyValues(lines: string[], keyIndex: number, endIndex: number): string[] {
	const values: string[] = [];
	const scalarValue = readYamlScalarValue(lines[keyIndex] ?? "");
	if (scalarValue) {
		values.push(scalarValue);
	}

	for (let index = keyIndex + 1; index < endIndex; index += 1) {
		const value = readYamlListLineValue(lines[index] ?? "");
		if (value) {
			values.push(value);
		}
	}

	return values;
}

function readYamlScalarValue(line: string): string {
	const separatorIndex = line.indexOf(":");
	if (separatorIndex === -1) {
		return "";
	}

	return unquoteYamlScalar(line.slice(separatorIndex + 1).trim());
}

function readYamlListLineValue(line: string): string {
	const match = /^[ \t]*-[ \t]*(.*)$/.exec(line);
	return match ? unquoteYamlScalar(match[1]?.trim() ?? "") : "";
}

function isYamlListProperty(lines: string[], keyIndex: number, endIndex: number): boolean {
	return endIndex > keyIndex + 1
		&& lines.slice(keyIndex + 1, endIndex).some((line) => /^[ \t]*-[ \t]*/.test(line));
}

function appendUniqueYamlValue(values: string[], value: string): string[] {
	const normalizedValue = normalizeYamlComparableValue(value);
	if (values.some((existingValue) => normalizeYamlComparableValue(existingValue) === normalizedValue)) {
		return values;
	}

	return [...values, value];
}

function normalizeYamlComparableValue(value: string): string {
	return unquoteYamlScalar(value).trim();
}

function unquoteYamlScalar(value: string): string {
	if (!value) {
		return "";
	}

	if (value.startsWith("\"") && value.endsWith("\"")) {
		try {
			return JSON.parse(value) as string;
		} catch {
			return value.slice(1, -1);
		}
	}

	if (value.startsWith("'") && value.endsWith("'")) {
		return value.slice(1, -1).replace(/''/g, "'");
	}

	return value;
}

function formatYamlListProperty(propertyName: string, values: string[]): string[] {
	return [
		`${formatYamlKey(propertyName)}:`,
		...values.map((item) => `  - ${formatYamlScalar(item)}`),
	];
}

function isYamlKeyLine(line: string, propertyName: string): boolean {
	return line.match(/^\S[^:]*:/) !== null && getYamlLineKey(line) === propertyName;
}

function getYamlLineKey(line: string): string {
	const separatorIndex = line.indexOf(":");
	if (separatorIndex === -1) {
		return "";
	}

	const rawKey = line.slice(0, separatorIndex).trim();

	if (
		(rawKey.startsWith("\"") && rawKey.endsWith("\""))
		|| (rawKey.startsWith("'") && rawKey.endsWith("'"))
	) {
		return rawKey.slice(1, -1);
	}

	return rawKey;
}

function findYamlPropertyEnd(lines: string[], startIndex: number): number {
	let endIndex = startIndex + 1;

	while (endIndex < lines.length) {
		const line = lines[endIndex];
		if (line === undefined || (!line.startsWith(" ") && !line.startsWith("\t") && line.trim() !== "")) {
			break;
		}

		endIndex += 1;
	}

	return endIndex;
}

function formatYamlKey(propertyName: string): string {
	if (/^[A-Za-z0-9_.-]+$/.test(propertyName)) {
		return propertyName;
	}

	return JSON.stringify(propertyName);
}

function formatYamlScalar(value: string | number): string {
	if (typeof value === "number") {
		return String(value);
	}

	if (canUsePlainYamlScalar(value)) {
		return value;
	}

	return JSON.stringify(value);
}

function canUsePlainYamlScalar(value: string): boolean {
	return value.trim() === value
		&& value.length > 0
		&& !/^(?:true|false|null|yes|no|on|off)$/i.test(value)
		&& !value.split("").some((character) => ":#{}[],&*?|".includes(character))
		&& !/^[-?!%@`]/.test(value)
		&& !/\s$/.test(value);
}
