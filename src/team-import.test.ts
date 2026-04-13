import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShowdownTeam, parseTeamInput } from './team-import.js';

const sample = `Scream Tail @ Booster Energy
Ability: Protosynthesis
Level: 55
Tera Type: Ghost
EVs: 252 hp / 4 atk / 60 def / 4 spd / 188 spe
Jolly Nature
- Rock Tomb
- Encore
- Disable
- Protect

Raging Bolt @ Assault Vest
Ability: Protosynthesis
Level: 75
Tera Type: Fairy
EVs: 188 hp / 92 def / 180 spa / 20 spd / 28 spe
IVs: 20 atk
Modest Nature
- Electroweb
- Dragon Pulse
- Thunderclap
- Snarl`;

test('parseShowdownTeam parses standard Showdown export text', () => {
	const team = parseShowdownTeam(sample);
	assert.equal(team.length, 2);
	assert.equal(team[0].species, 'Scream Tail');
	assert.equal(team[0].item, 'Booster Energy');
	assert.equal(team[0].ability, 'Protosynthesis');
	assert.equal(team[0].level, 55);
	assert.equal(team[0].teraType, 'Ghost');
	assert.equal(team[0].nature, 'Jolly');
	assert.deepEqual(team[0].moves, ['Rock Tomb', 'Encore', 'Disable', 'Protect']);
	assert.equal(team[0].evs.hp, 252);
	assert.equal(team[0].evs.spe, 188);

	assert.equal(team[1].species, 'Raging Bolt');
	assert.equal(team[1].ivs.atk, 20);
	assert.equal(team[1].ivs.hp, 31);
	assert.equal(team[1].evs.spa, 180);
	assert.equal(team[1].nature, 'Modest');
});

test('parseTeamInput supports JSON and Showdown formats', () => {
	const jsonTeam = '[{"species":"Pikachu","level":50,"nature":"Serious","ivs":{"hp":31,"atk":31,"def":31,"spa":31,"spd":31,"spe":31},"evs":{"hp":0,"atk":0,"def":0,"spa":252,"spd":4,"spe":252},"moves":["Thunderbolt"]}]';
	const fromJson = parseTeamInput(jsonTeam);
	assert.equal(fromJson.length, 1);
	assert.equal(fromJson[0].species, 'Pikachu');

	const fromShowdown = parseTeamInput(sample);
	assert.equal(fromShowdown.length, 2);
	assert.equal(fromShowdown[0].species, 'Scream Tail');
});
