import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrainerScript } from '../src/trainers.js';

const mockScriptLet = `
let wally = document.querySelector('#wally');
let brendan = document.querySelector('#brendan');

let rs_trainers = [
  {namea: "Ralts", levela: "Lv. 11", move1a: "Growl", move2a: "Confusion"},
  {namea: "Gardevoir", levela: "Lv. 45", nameb: "Altaria", levelb: "Lv. 43", move1b: "Dragon Breath"}
];
`;

const mockScriptConst = `
const wally = document.querySelector('#wally');
const brendan = document.querySelector('#brendan');

const rs_trainers = [
  {namea: "Ralts", levela: "Lv. 11", move1a: "Growl", move2a: "Confusion"},
  {namea: "Gardevoir", levela: "Lv. 45", nameb: "Altaria", levelb: "Lv. 43", move1b: "Dragon Breath"}
];
`;

const mockScriptVar = `
var wally = document.querySelector('#wally');
var brendan = document.querySelector('#brendan');

var rs_trainers = [
  {namea: "Ralts", levela: "Lv. 11", move1a: "Growl", move2a: "Confusion"},
  {namea: "Gardevoir", levela: "Lv. 45", nameb: "Altaria", levelb: "Lv. 43", move1b: "Dragon Breath"}
];
`;

const mockScriptNestedArrays = `
let wally = document.querySelector('#wally');

let rs_trainers = [
  {namea: "Ralts", levela: "Lv. 11", movesa: ["Growl", "Confusion"]},
  {namea: "Gardevoir", levela: "Lv. 45"}
];
`;

const mockScriptBracketInString = `
let wally = document.querySelector('#wally');

let rs_trainers = [
  {namea: "Ralts [Hoenn]", levela: "Lv. 11", move1a: "Growl"}
];
`;

test('parseTrainerScript parses let-based trainer script', () => {
	const team = parseTrainerScript(mockScriptLet, 'Wally', 'rs');
	assert.equal(team.length, 1);
	assert.equal(team[0].species, 'Ralts');
	assert.equal(team[0].level, 11);
	assert.ok(team[0].moves.some(mv => mv === 'Growl' || mv === 'Confusion'));
});

test('parseTrainerScript parses const-based trainer script (Gen 3 format)', () => {
	const team = parseTrainerScript(mockScriptConst, 'Wally', 'rs');
	assert.equal(team.length, 1);
	assert.equal(team[0].species, 'Ralts');
	assert.equal(team[0].level, 11);
});

test('parseTrainerScript parses var-based trainer script', () => {
	const team = parseTrainerScript(mockScriptVar, 'Wally', 'rs');
	assert.equal(team.length, 1);
	assert.equal(team[0].species, 'Ralts');
});

test('parseTrainerScript handles trainer with multiple Pokemon', () => {
	const team = parseTrainerScript(mockScriptLet, 'Brendan', 'rs');
	assert.equal(team.length, 2);
	assert.equal(team[0].species, 'Gardevoir');
	assert.equal(team[1].species, 'Altaria');
});

test('parseTrainerScript handles trainer arrays with nested arrays', () => {
	const team = parseTrainerScript(mockScriptNestedArrays, 'Wally', 'rs');
	assert.equal(team.length, 1);
	assert.equal(team[0].species, 'Ralts');
});

test('parseTrainerScript handles species names containing brackets', () => {
	const team = parseTrainerScript(mockScriptBracketInString, 'Wally', 'rs');
	assert.equal(team.length, 1);
	assert.equal(team[0].species, 'Ralts [Hoenn]');
});

test('parseTrainerScript throws when trainer is not found', () => {
	assert.throws(
		() => parseTrainerScript(mockScriptLet, 'UnknownTrainer', 'rs'),
		/Trainer UnknownTrainer not found in rs/,
	);
});

test('parseTrainerScript throws when trainer array is missing', () => {
	const badScript = `
let wally = document.querySelector('#wally');
let rs_data = [{namea: "Ralts"}];
`;
	assert.throws(
		() => parseTrainerScript(badScript, 'Wally', 'rs'),
		/Could not locate trainer array in rs\.js/,
	);
});
