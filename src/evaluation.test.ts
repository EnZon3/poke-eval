import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA_CACHE, setActiveGeneration } from './data.js';
import { buildPokemon } from './pokemon.js';
import { baseDamageWithoutRandom, computeDamageProfile } from './evaluation/damage.js';
import { evaluateTeams as evaluateTeamsCompat } from './evaluation.js';
import { evaluateTeams } from './evaluation/index.js';
import type { MoveEntry, PokemonSet, SpeciesEntry } from './types.js';

function resetDataCache(): void {
	delete DATA_CACHE.species;
	delete DATA_CACHE.moves;
	delete DATA_CACHE.abilities;
	delete DATA_CACHE.items;
	setActiveGeneration(9);
}

function seedDataCache(): void {
	setActiveGeneration(9);
	const species: Record<string, SpeciesEntry> = {
		pikachu: { name: 'Pikachu', types: ['Electric'], baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 } },
		bulbasaur: { name: 'Bulbasaur', types: ['Grass', 'Poison'], baseStats: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 } },
		charmander: { name: 'Charmander', types: ['Fire'], baseStats: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 } },
		charizard: { name: 'Charizard', types: ['Fire', 'Flying'], baseStats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 }, defaultAbility: 'Blaze' },
		charizardmegax: { name: 'Charizard-Mega-X', types: ['Fire', 'Dragon'], baseStats: { hp: 78, atk: 130, def: 111, spa: 130, spd: 85, spe: 100 }, defaultAbility: 'Tough Claws' },
		'charizard-mega-x': { name: 'Charizard-Mega-X', types: ['Fire', 'Dragon'], baseStats: { hp: 78, atk: 130, def: 111, spa: 130, spd: 85, spe: 100 }, defaultAbility: 'Tough Claws' },
		squirtle: { name: 'Squirtle', types: ['Water'], baseStats: { hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 } },
		geodude: { name: 'Geodude', types: ['Rock', 'Ground'], baseStats: { hp: 40, atk: 80, def: 100, spa: 30, spd: 30, spe: 20 } },
		gastly: { name: 'Gastly', types: ['Ghost', 'Poison'], baseStats: { hp: 30, atk: 35, def: 30, spa: 100, spd: 35, spe: 80 } },
	};

	const moves: Record<string, MoveEntry> = {
		thunderbolt: { name: 'Thunderbolt', type: 'Electric', basePower: 90, category: 'Special', accuracy: 100, priority: 0 },
		vinewhip: { name: 'Vine Whip', type: 'Grass', basePower: 45, category: 'Physical', accuracy: 100, priority: 0 },
		ember: { name: 'Ember', type: 'Fire', basePower: 40, category: 'Special', accuracy: 100, priority: 0 },
		watergun: { name: 'Water Gun', type: 'Water', basePower: 40, category: 'Special', accuracy: 100, priority: 0 },
		waterslap: { name: 'Water Slap', type: 'Water', basePower: 25, category: 'Physical', accuracy: 100, priority: 0 },
		surgingstrikes: { name: 'Surging Strikes', type: 'Water', basePower: 25, category: 'Physical', accuracy: 100, priority: 0, willCrit: true, multiHit: 3 },
		dragonclaw: { name: 'Dragon Claw', type: 'Dragon', basePower: 80, category: 'Physical', accuracy: 100, priority: 0 },
		tackle: { name: 'Tackle', type: 'Normal', basePower: 40, category: 'Physical', accuracy: 100, priority: 0 },
		shadowball: { name: 'Shadow Ball', type: 'Ghost', basePower: 80, maxMoveBasePower: 130, category: 'Special', accuracy: 100, priority: 0 },
		fakeout: { name: 'Fake Out', type: 'Normal', basePower: 40, category: 'Physical', accuracy: 100, priority: 3 },
		protect: { name: 'Protect', type: 'Normal', basePower: 0, category: 'Status', accuracy: true, priority: 4 },
	};

	DATA_CACHE.species = species;
	DATA_CACHE.moves = moves;
	DATA_CACHE.abilities = {};
	DATA_CACHE.items = {};
}

function set(species: string, moves: string[]): PokemonSet {
	return {
		species,
		level: 50,
		nature: 'Hardy',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
		moves,
	};
}

test('evaluateTeams throws when data cache is not initialized', () => {
	resetDataCache();
	assert.throws(
		() => evaluateTeams([set('Pikachu', ['Thunderbolt'])], [set('Squirtle', ['Water Gun'])]),
		/Data not loaded; call loadData\(\) first/,
	);
});

test('singles evaluation returns sorted entries with hazard switch-in notes', () => {
	seedDataCache();
	const myTeam = [
		set('Pikachu', ['Thunderbolt', 'Tackle']),
		set('Bulbasaur', ['Vine Whip', 'Tackle']),
	];
	const enemyTeam = [set('Squirtle', ['Water Gun', 'Tackle'])];
	const result = evaluateTeams(myTeam, enemyTeam, {
		battleFormat: 'singles',
		allowSwitching: true,
		battleState: {
			weather: 'none',
			terrain: 'none',
			mySide: { stealthRock: true, spikesLayers: 1 },
			enemySide: {},
		},
	});

	const entries = result.Squirtle;
	assert.equal(entries.length, 2);
	assert.ok(entries[0].score >= entries[1].score);
	assert.ok(entries.every((entry) => entry.confidence !== undefined));
	assert.ok(entries.every((entry) => entry.rationale && entry.rationale.length > 0));
	assert.ok(entries.every((entry) => entry.notes?.some(note => note.includes('Switch-in hazards estimate'))));
});

test('gimmickControl auto mode evaluates branch timing and annotates best-response notes', () => {
	seedDataCache();
	const myTeam: PokemonSet[] = [
		{
			...set('Pikachu', ['Thunderbolt', 'Tackle']),
			teraType: 'Electric',
		},
	];
	const enemyTeam: PokemonSet[] = [
		{
			...set('Squirtle', ['Water Gun', 'Tackle']),
			teraType: 'Water',
		},
	];

	const manual = evaluateTeams(myTeam, enemyTeam, {
		battleFormat: 'singles',
		gimmickControl: 'manual',
	});
	const auto = evaluateTeams(myTeam, enemyTeam, {
		battleFormat: 'singles',
		gimmickControl: 'auto',
	});

	const manualTop = manual.Squirtle?.[0];
	const autoTop = auto.Squirtle?.[0];
	assert.ok(manualTop);
	assert.ok(autoTop);
	assert.ok(!(manualTop.notes ?? []).some(note => note.includes('Auto gimmick timing selected')));
	assert.ok((autoTop.notes ?? []).some(note => note.includes('Opponent best response assumes')));
});

test('doubles evaluation returns lead-pair results and applies combined hazard penalty note', () => {
	seedDataCache();
	const myTeam = [
		set('Pikachu', ['Thunderbolt', 'Fake Out']),
		set('Bulbasaur', ['Vine Whip', 'Protect']),
		set('Gastly', ['Shadow Ball', 'Protect']),
	];
	const enemyTeam = [
		set('Charmander', ['Ember', 'Tackle']),
		set('Squirtle', ['Water Gun', 'Tackle']),
	];

	const result = evaluateTeams(myTeam, enemyTeam, {
		battleFormat: 'doubles',
		allowSwitching: true,
		battleState: {
			weather: 'none',
			terrain: 'none',
			mySide: { stealthRock: true, spikesLayers: 2 },
			enemySide: {},
		},
	});

	const key = 'Charmander + Squirtle';
	assert.ok(result[key]);
	assert.equal(result[key].length, 3);
	assert.ok(result[key][0].score >= result[key][1].score);
	assert.ok(result[key][1].score >= result[key][2].score);
	assert.ok(result[key].every((entry) => entry.pokemon.includes(' + ')));
	assert.ok(result[key].some((entry) => entry.notes?.some((note) => note.includes('Lead switch-in hazards estimate'))));
});

test('compatibility wrapper re-export matches evaluation module entrypoint output', () => {
	seedDataCache();
	const myTeam = [set('Pikachu', ['Thunderbolt']), set('Geodude', ['Tackle'])];
	const enemyTeam = [set('Squirtle', ['Water Gun'])];
	const options = { battleFormat: 'singles' as const, mode: 'competitive' as const };
	const direct = evaluateTeams(myTeam, enemyTeam, options);
	const wrapped = evaluateTeamsCompat(myTeam, enemyTeam, options);
	assert.deepEqual(wrapped, direct);
});

test('buildPokemon gates Mega, Tera, and Dynamax by generation', () => {
	seedDataCache();
	const charizardSet: PokemonSet = {
		species: 'Charizard',
		level: 50,
		nature: 'Hardy',
		megaForm: 'Mega-X',
		teraType: 'Dragon',
		dynamax: true,
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
		moves: ['Flamethrower'],
	};

	setActiveGeneration(5);
	const gen5 = buildPokemon(charizardSet);
	assert.equal(gen5.species.name, 'Charizard');
	assert.equal(gen5.megaForm, undefined);

	setActiveGeneration(6);
	const gen6 = buildPokemon(charizardSet);
	assert.equal(gen6.species.name, 'Charizard-Mega-X');
	assert.equal(gen6.megaForm, 'Charizard-Mega-X');
	assert.equal(gen6.ability, 'Tough Claws');
	assert.equal(gen6.teraType, undefined);
	assert.equal(gen6.dynamax, false);

	setActiveGeneration(8);
	const gen8 = buildPokemon(charizardSet);
	assert.equal(gen8.species.name, 'Charizard');
	assert.equal(gen8.megaForm, undefined);
	assert.equal(gen8.teraType, undefined);
	assert.equal(gen8.dynamax, true);

	setActiveGeneration(9);
	const gen9 = buildPokemon(charizardSet);
	assert.equal(gen9.species.name, 'Charizard');
	assert.equal(gen9.megaForm, undefined);
	assert.equal(gen9.teraType, 'Dragon');
	assert.equal(gen9.dynamax, false);

	const gen9NoGimmicks = buildPokemon(charizardSet, { disableBattleGimmicks: true });
	assert.equal(gen9NoGimmicks.species.name, 'Charizard');
	assert.equal(gen9NoGimmicks.megaForm, undefined);
	assert.equal(gen9NoGimmicks.teraType, undefined);
	assert.equal(gen9NoGimmicks.dynamax, false);
});

test('dynamax damage path uses move maxMoveBasePower when available', () => {
	seedDataCache();
	setActiveGeneration(8);

	const attackerBase = buildPokemon({
		species: 'Gastly',
		level: 50,
		nature: 'Hardy',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 0, spe: 0 },
		moves: ['Shadow Ball'],
		dynamax: false,
	});
	const attackerDynamax = buildPokemon({
		species: 'Gastly',
		level: 50,
		nature: 'Hardy',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 0, spe: 0 },
		moves: ['Shadow Ball'],
		dynamax: true,
	});
	const defender = buildPokemon({
		species: 'Pikachu',
		level: 50,
		nature: 'Hardy',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
		moves: ['Tackle'],
	});

	const baseMove = attackerBase.moves[0];
	const baseDamage = baseDamageWithoutRandom(attackerBase, defender, baseMove, undefined, true);
	const dynamaxDamage = baseDamageWithoutRandom(attackerDynamax, defender, attackerDynamax.moves[0], undefined, true);
	const expectedRatio = (baseMove.maxMoveBasePower ?? baseMove.basePower) / baseMove.basePower;

	assert.ok(dynamaxDamage > baseDamage);
	assert.ok(Math.abs((dynamaxDamage / baseDamage) - expectedRatio) < 0.05);
});

test('terastallization applies expected STAB multipliers for same-type and off-type tera', () => {
	seedDataCache();
	setActiveGeneration(9);

	const target = buildPokemon({
		species: 'Squirtle',
		level: 50,
		nature: 'Hardy',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 },
		moves: ['Tackle'],
	});

	const sameTypeBase = buildPokemon({
		species: 'Bulbasaur',
		level: 50,
		nature: 'Hardy',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 0 },
		moves: ['Vine Whip'],
	});
	const sameTypeTera = buildPokemon({
		species: 'Bulbasaur',
		level: 50,
		nature: 'Hardy',
		teraType: 'Grass',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 0 },
		moves: ['Vine Whip'],
	});

	const offTypeBase = buildPokemon({
		species: 'Charmander',
		level: 50,
		nature: 'Hardy',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 0, spe: 0 },
		moves: ['Water Gun'],
	});
	const offTypeTera = buildPokemon({
		species: 'Charmander',
		level: 50,
		nature: 'Hardy',
		teraType: 'Water',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 0, spe: 0 },
		moves: ['Water Gun'],
	});

	const sameTypeBaseDamage = baseDamageWithoutRandom(sameTypeBase, target, sameTypeBase.moves[0], undefined, true);
	const sameTypeTeraDamage = baseDamageWithoutRandom(sameTypeTera, target, sameTypeTera.moves[0], undefined, true);
	const offTypeBaseDamage = baseDamageWithoutRandom(offTypeBase, target, offTypeBase.moves[0], undefined, true);
	const offTypeTeraDamage = baseDamageWithoutRandom(offTypeTera, target, offTypeTera.moves[0], undefined, true);

	assert.ok(Math.abs((sameTypeTeraDamage / sameTypeBaseDamage) - (2 / 1.5)) < 0.05);
	assert.ok(Math.abs((offTypeTeraDamage / offTypeBaseDamage) - 1.5) < 0.05);
});

test('guaranteed critical multi-hit moves apply crit and fixed hit count', () => {
	seedDataCache();
	setActiveGeneration(9);

	const attackerSingle = buildPokemon({
		species: 'Squirtle',
		level: 50,
		nature: 'Hardy',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 0 },
		moves: ['Water Slap'],
	});
	const attackerMulti = buildPokemon({
		species: 'Squirtle',
		level: 50,
		nature: 'Hardy',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 0 },
		moves: ['Surging Strikes'],
	});
	const defender = buildPokemon({
		species: 'Charmander',
		level: 50,
		nature: 'Hardy',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
		moves: ['Tackle'],
	});

	const singleMove = attackerSingle.moves[0];
	const multiMove = attackerMulti.moves[0];
	const singleBase = baseDamageWithoutRandom(attackerSingle, defender, singleMove, undefined, true);
	const multiBase = baseDamageWithoutRandom(attackerMulti, defender, multiMove, undefined, true);
	const multiProfile = computeDamageProfile(attackerMulti, defender, multiMove, undefined, true);

	assert.ok(Math.abs((multiBase / singleBase) - 1.5) < 0.05);
	assert.equal(multiProfile.min, Math.floor(multiBase * 0.85) * 3);
	assert.equal(multiProfile.max, Math.floor(multiBase) * 3);
	assert.ok(multiProfile.expected > singleBase * 3.9);
});
