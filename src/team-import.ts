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
		const match = trimmed.match(/^(\d+)\s+(.+)$/);
		if (!match) continue;
		const value = Number.parseInt(match[1], 10);
		if (Number.isNaN(value)) continue;
		const key = statKey(match[2]);
		if (!key) continue;
		next[key] = value;
	}
	return next;
}

function speciesFromShowdownHeader(raw: string): string {
	let value = raw.trim();
	const atIndex = value.indexOf('@');
	if (atIndex >= 0) value = value.slice(0, atIndex).trim();

	const nicknameMatch = value.match(/^.*\(([^()]+)\)$/);
	if (nicknameMatch) value = nicknameMatch[1].trim();
	value = value.replace(/\s*\((M|F)\)$/i, '').replace(/,\s*(M|F)$/i, '').trim();
	return value;
}

function itemFromShowdownHeader(raw: string): string | undefined {
	const atIndex = raw.indexOf('@');
	if (atIndex < 0) return undefined;
	const item = raw.slice(atIndex + 1).trim();
	return item || undefined;
}

function parseShowdownSet(block: string): PokemonSet | null {
	const lines = block
		.split(/\r?\n/)
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
			const move = line.replace(/^-+\s*/, '').trim();
			if (move) moves.push(move);
			continue;
		}
		const abilityMatch = line.match(/^Ability:\s*(.+)$/i);
		if (abilityMatch) {
			ability = abilityMatch[1].trim() || undefined;
			continue;
		}
		const itemMatch = line.match(/^Item:\s*(.+)$/i);
		if (itemMatch) {
			item = itemMatch[1].trim() || item;
			continue;
		}
		const levelMatch = line.match(/^Level:\s*(\d+)$/i);
		if (levelMatch) {
			const parsed = Number.parseInt(levelMatch[1], 10);
			if (!Number.isNaN(parsed)) level = parsed;
			continue;
		}
		const teraMatch = line.match(/^Tera\s+Type:\s*(.+)$/i);
		if (teraMatch) {
			teraType = teraMatch[1].trim() || undefined;
			continue;
		}
		const evMatch = line.match(/^EVs:\s*(.+)$/i);
		if (evMatch) {
			evs = parseSpread(evMatch[1], evs);
			continue;
		}
		const ivMatch = line.match(/^IVs:\s*(.+)$/i);
		if (ivMatch) {
			ivs = parseSpread(ivMatch[1], ivs);
			continue;
		}
		const natureMatch = line.match(/^([A-Za-z]+)\s+Nature$/i);
		if (natureMatch) {
			nature = natureMatch[1].trim();
			continue;
		}
		const dynamaxMatch = line.match(/^Dynamax:\s*(yes|true|1)$/i);
		if (dynamaxMatch) {
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
	const blocks = text
		.trim()
		.split(/\n\s*\n+/)
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
