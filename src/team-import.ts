import { readFileSync } from 'node:fs';
import type { PokemonSet, Stats } from './types.js';
import { toID } from './utils.js';

const ZERO_STATS: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const PERFECT_IVS: Stats = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

function statKey(label: string): keyof Stats | undefined {
	switch (toID(label)) {
		case 'hp':
			return 'hp';
		case 'atk':
		case 'attack':
			return 'atk';
		case 'def':
		case 'defense':
			return 'def';
		case 'spa':
		case 'spatk':
		case 'specialattack':
		case 'satk':
			return 'spa';
		case 'spd':
		case 'spdef':
		case 'specialdefense':
		case 'sdef':
			return 'spd';
		case 'spe':
		case 'speed':
			return 'spe';
		default:
			return undefined;
	}
}

function parseSpread(line: string, base: Stats): Stats {
	const next = { ...base };
	for (const segment of line.split('/')) {
		const trimmed = segment.trim();
		if (!trimmed) continue;
		const spaceIndex = firstWhitespaceIndex(trimmed);
		if (spaceIndex <= 0) continue;
		const statValue = trimmed.slice(0, spaceIndex);
		const value = isDecimalInteger(statValue) ? Number.parseInt(statValue, 10) : Number.NaN;
		if (Number.isNaN(value)) continue;
		const key = statKey(trimmed.slice(spaceIndex).trim());
		if (!key) continue;
		next[key] = value;
	}
	return next;
}

function firstWhitespaceIndex(value: string): number {
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 32) return i;
	}
	return -1;
}

function isAsciiAlpha(value: string): boolean {
	if (!value) return false;
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if ((code < 65 || code > 90) && (code < 97 || code > 122)) return false;
	}
	return true;
}

function isDecimalInteger(value: string): boolean {
	if (!value) return false;
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code < 48 || code > 57) return false;
	}
	return true;
}

function prefixedValue(line: string, prefix: string): string | undefined {
	if (!line.toLowerCase().startsWith(prefix.toLowerCase())) return undefined;
	const value = line.slice(prefix.length).trim();
	return value || undefined;
}

function splitLines(value: string): string[] {
	const lines: string[] = [];
	let start = 0;
	for (let i = 0; i < value.length; i += 1) {
		if (value[i] !== '\n') continue;
		const end = i > start && value[i - 1] === '\r' ? i - 1 : i;
		lines.push(value.slice(start, end));
		start = i + 1;
	}
	lines.push(value.slice(start));
	return lines;
}

function splitTeamBlocks(value: string): string[] {
	const blocks: string[] = [];
	let current: string[] = [];
	for (const rawLine of splitLines(value.trim())) {
		if (rawLine.trim()) {
			current.push(rawLine);
			continue;
		}
		if (current.length > 0) {
			blocks.push(current.join('\n'));
			current = [];
		}
	}
	if (current.length > 0) blocks.push(current.join('\n'));
	return blocks;
}

function speciesFromShowdownHeader(raw: string): string {
	let value = raw.trim();
	const atIndex = value.indexOf('@');
	if (atIndex >= 0) value = value.slice(0, atIndex).trim();

	if (value.endsWith(')')) {
		const openIndex = value.lastIndexOf('(');
		const inner = openIndex >= 0 ? value.slice(openIndex + 1, -1).trim() : '';
		const lowerInner = inner.toLowerCase();
		if (inner && lowerInner !== 'm' && lowerInner !== 'f' && !inner.includes('(') && !inner.includes(')')) {
			value = inner;
		}
	}
	const lowerValue = value.toLowerCase();
	if (lowerValue.endsWith(' (m)') || lowerValue.endsWith(' (f)')) {
		value = value.slice(0, -4).trim();
	}
	const genderSuffix = value.slice(-3).toLowerCase();
	if (genderSuffix === ', m' || genderSuffix === ', f') {
		value = value.slice(0, -3).trim();
	}
	return value;
}

function itemFromShowdownHeader(raw: string): string | undefined {
	const atIndex = raw.indexOf('@');
	if (atIndex < 0) return undefined;
	const item = raw.slice(atIndex + 1).trim();
	return item || undefined;
}

function parseShowdownSet(block: string): PokemonSet | null {
	const lines = splitLines(block)
		.map(line => line.trim())
		.filter(Boolean);
	if (lines.length === 0) return null;

	const header = lines[0];
	const species = speciesFromShowdownHeader(header);
	if (!species) return null;

	let level = 50;
	let nature = 'Serious';
	let ability: string | undefined;
	let item = itemFromShowdownHeader(header);
	let teraType: string | undefined;
	let dynamax = false;
	let evs: Stats = { ...ZERO_STATS };
	let ivs: Stats = { ...PERFECT_IVS };
	const moves: string[] = [];

	for (const line of lines.slice(1)) {
		if (line.startsWith('-')) {
			let start = 0;
			while (line[start] === '-') start += 1;
			const move = line.slice(start).trim();
			if (move) moves.push(move);
			continue;
		}
		const abilityValue = prefixedValue(line, 'Ability:');
		if (abilityValue) {
			ability = abilityValue;
			continue;
		}
		const itemValue = prefixedValue(line, 'Item:');
		if (itemValue) {
			item = itemValue;
			continue;
		}
		const levelValue = prefixedValue(line, 'Level:');
		if (levelValue) {
			const parsed = isDecimalInteger(levelValue) ? Number.parseInt(levelValue, 10) : Number.NaN;
			if (!Number.isNaN(parsed)) level = parsed;
			continue;
		}
		const teraValue = prefixedValue(line, 'Tera Type:');
		if (teraValue) {
			teraType = teraValue;
			continue;
		}
		const evValue = prefixedValue(line, 'EVs:');
		if (evValue) {
			evs = parseSpread(evValue, evs);
			continue;
		}
		const ivValue = prefixedValue(line, 'IVs:');
		if (ivValue) {
			ivs = parseSpread(ivValue, ivs);
			continue;
		}
		if (line.toLowerCase().endsWith(' nature')) {
			const natureValue = line.slice(0, -' Nature'.length).trim();
			if (isAsciiAlpha(natureValue)) nature = natureValue;
			continue;
		}
		const dynamaxValue = prefixedValue(line, 'Dynamax:')?.toLowerCase();
		if (dynamaxValue === 'yes' || dynamaxValue === 'true' || dynamaxValue === '1') {
			dynamax = true;
		}
	}

	return {
		species,
		level,
		nature,
		ability,
		item,
		teraType,
		dynamax,
		ivs,
		evs,
		moves: moves.slice(0, 4),
	};
}

export function parseShowdownTeam(text: string): PokemonSet[] {
	const blocks = splitTeamBlocks(text)
		.map(block => block.trim())
		.filter(Boolean);

	const team = blocks
		.map(parseShowdownSet)
		.filter((set): set is PokemonSet => Boolean(set));

	if (team.length === 0) {
		throw new Error('Unable to parse Showdown team text.');
	}
	return team;
}

function isPokemonSetArray(value: unknown): value is PokemonSet[] {
	if (!Array.isArray(value)) return false;
	return value.every((entry) => {
		if (!entry || typeof entry !== 'object') return false;
		const set = entry as Partial<PokemonSet>;
		return typeof set.species === 'string' && Array.isArray(set.moves);
	});
}

export function parseTeamInput(text: string): PokemonSet[] {
	try {
		const parsed = JSON.parse(text) as unknown;
		if (isPokemonSetArray(parsed)) return parsed;
	} catch {
		// Fall through to Showdown parser.
	}
	return parseShowdownTeam(text);
}

export function loadTeamInputFile(filePath: string): PokemonSet[] {
	return parseTeamInput(readFileSync(filePath, 'utf8'));
}
