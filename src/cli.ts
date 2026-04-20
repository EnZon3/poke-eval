import { readFileSync } from 'node:fs';
import { loadData } from './data.js';
import { evaluateTeams } from './evaluation/index.js';
import { promptForTeam, printResultsPretty, runTUI } from './interactive.js';
import { loadTeamFromSaveFile } from './save-import.js';
import { parseTeamInput } from './team-import.js';
import { fetchTrainerTeamFromSource } from './trainers.js';
import type { DataSource, EvaluationOptions, PokemonSet, TrainerSource } from './types.js';
import {
	parseAgainstTrainer,
	parseBattleFormat,
	parseDataSource,
	parseGeneration,
	parseTerrain,
	parseTrainerSource,
	parseWeather,
} from './utils.js';

export function isMain(): boolean {
	const hasRequire = typeof require !== 'undefined';
	if (hasRequire) {
		// @ts-ignore
		return require.main === module;
	}
	if (typeof import.meta !== 'undefined' && typeof import.meta.url === 'string') {
		if (import.meta.url.startsWith('file://')) {
			const decoded = decodeURI(import.meta.url.slice('file://'.length));
			return !!process.argv[1] && process.argv[1] === decoded;
		}
		return false;
	}
	return false;
}

type ParsedCliArg =
	| { kind: 'kv'; key: string; value: string }
	| { kind: 'flag'; key: string };

function parseCliArg(arg: string): ParsedCliArg | undefined {
	if (!arg.startsWith('--')) return undefined;
	const body = arg.slice(2);
	const eq = body.indexOf('=');
	if (eq === -1) return { kind: 'flag', key: body };
	return {
		kind: 'kv',
		key: body.slice(0, eq),
		value: body.slice(eq + 1),
	};
}

function parseOption<T>(raw: string, parser: (value: string) => T | undefined, errorMessage: string): T {
	const parsed = parser(raw);
	if (!parsed) throw new Error(errorMessage);
	return parsed;
}

function parseIntegerOption(raw: string, isValid: (value: number) => boolean, errorMessage: string): number {
	const value = parseInt(raw, 10);
	if (!isValid(value)) throw new Error(errorMessage);
	return value;
}

function parseNumberOption(raw: string, isValid: (value: number) => boolean, errorMessage: string): number {
	const value = Number(raw);
	if (!isValid(value)) throw new Error(errorMessage);
	return value;
}

function applyModeDefaults(options: EvaluationOptions, mode: 'casual' | 'competitive' | 'custom'): void {
	options.mode = mode;
	if (mode === 'casual') {
		options.lookaheadTurns = 2;
		options.defensiveWeight = 0.22;
		options.opponentRiskWeight = 0.5;
	}
	if (mode === 'competitive') {
		options.lookaheadTurns = 3;
		options.defensiveWeight = 0.4;
		options.opponentRiskWeight = 0.65;
	}
}

function ensureMySide(options: EvaluationOptions): NonNullable<NonNullable<EvaluationOptions['battleState']>['mySide']> {
	options.battleState = options.battleState ?? {};
	options.battleState.mySide = options.battleState.mySide ?? {};
	return options.battleState.mySide;
}

function ensureEnemySide(options: EvaluationOptions): NonNullable<NonNullable<EvaluationOptions['battleState']>['enemySide']> {
	options.battleState = options.battleState ?? {};
	options.battleState.enemySide = options.battleState.enemySide ?? {};
	return options.battleState.enemySide;
}

export async function runCli(): Promise<void> {
	const args = process.argv.slice(2);
	const packagedBinary = Boolean((process as { pkg?: unknown }).pkg);
	let showHelp = false;
	let launchTui = args.length === 0 && !packagedBinary;
	let jsonOutput = false;
	let gen: number | undefined;
	let dataSource: DataSource = 'showdown';
	let trainerSource: TrainerSource = 'littleroot';
	const evaluationOptions: EvaluationOptions = {
		battleState: { weather: 'none', terrain: 'none', mySide: {}, enemySide: {} },
		battleFormat: 'singles',
		mode: 'casual',
		lookaheadTurns: 2,
		allowSwitching: false,
		roleWeight: 0.12,
		defensiveWeight: 0.3,
		opponentRiskWeight: 0.55,
	};
	let game: string | undefined;
	let trainerName: string | undefined;
	let myFile: string | undefined;
	let mySaveFile: string | undefined;
	let enemyFile: string | undefined;
	let enemyBuilder = false;

	const kvHandlers: Record<string, (value: string) => void> = {
		gen(value) {
			gen = parseOption(value, parseGeneration, `Invalid generation: ${value}. Use 1-9 or aliases like rby/swsh/sv.`);
		},
		game(value) {
			game = value;
		},
		'data-source'(value) {
			dataSource = parseOption(value, parseDataSource, 'Invalid --data-source. Use showdown or pokeapi.');
		},
		'trainer-source'(value) {
			trainerSource = parseOption(value, parseTrainerSource, 'Invalid --trainer-source. Use littleroot or pokeapi.');
		},
		trainer(value) {
			trainerName = value;
		},
		mode(value) {
			const normalizedMode = value.trim().toLowerCase();
			if (normalizedMode !== 'casual' && normalizedMode !== 'competitive' && normalizedMode !== 'custom') {
				throw new Error('Invalid --mode. Use casual, competitive, or custom.');
			}
			applyModeDefaults(evaluationOptions, normalizedMode);
		},
		format(value) {
			evaluationOptions.battleFormat = parseOption(value, parseBattleFormat, 'Invalid --format. Use singles or doubles.');
		},
		weather(value) {
			evaluationOptions.battleState = evaluationOptions.battleState ?? {};
			evaluationOptions.battleState.weather = parseOption(value, parseWeather, 'Invalid --weather. Use sun, rain, sand, snow, or none.');
		},
		terrain(value) {
			evaluationOptions.battleState = evaluationOptions.battleState ?? {};
			evaluationOptions.battleState.terrain = parseOption(value, parseTerrain, 'Invalid --terrain. Use electric, grassy, misty, psychic, or none.');
		},
		lookahead(value) {
			evaluationOptions.lookaheadTurns = parseIntegerOption(value, (v) => v === 1 || v === 2 || v === 3, 'Invalid --lookahead. Use 1, 2, or 3.') as 1 | 2 | 3;
		},
		'role-weight'(value) {
			evaluationOptions.roleWeight = parseNumberOption(value, (v) => !Number.isNaN(v) && v >= 0, 'Invalid --role-weight. Use a non-negative number.');
		},
		'defensive-weight'(value) {
			evaluationOptions.defensiveWeight = parseNumberOption(value, (v) => !Number.isNaN(v) && v >= 0, 'Invalid --defensive-weight. Use a non-negative number.');
		},
		'opponent-risk-weight'(value) {
			evaluationOptions.opponentRiskWeight = parseNumberOption(value, (v) => !Number.isNaN(v) && v >= 0 && v <= 1, 'Invalid --opponent-risk-weight. Use a number from 0 to 1.');
		},
		'my-spikes'(value) {
			const spikes = parseIntegerOption(value, (v) => !Number.isNaN(v) && v >= 0 && v <= 3, 'Invalid --my-spikes. Use 0..3.');
			ensureMySide(evaluationOptions).spikesLayers = spikes as 0 | 1 | 2 | 3;
		},
		'against-trainer'(value) {
			const parsed = parseAgainstTrainer(value);
			game = parsed.game;
			trainerName = parsed.trainerName;
		},
		my(value) {
			myFile = value;
		},
		'my-save'(value) {
			mySaveFile = value;
		},
		enemy(value) {
			enemyFile = value;
		},
	};

	const flagHandlers: Record<string, () => void> = {
		'allow-switching'() {
			evaluationOptions.allowSwitching = true;
		},
		'my-reflect'() {
			ensureMySide(evaluationOptions).reflect = true;
		},
		'my-light-screen'() {
			ensureMySide(evaluationOptions).lightScreen = true;
		},
		'enemy-reflect'() {
			ensureEnemySide(evaluationOptions).reflect = true;
		},
		'enemy-light-screen'() {
			ensureEnemySide(evaluationOptions).lightScreen = true;
		},
		'my-stealth-rock'() {
			ensureMySide(evaluationOptions).stealthRock = true;
		},
		interactive() {
			launchTui = true;
		},
		tui() {
			launchTui = true;
		},
		json() {
			jsonOutput = true;
		},
		help() {
			showHelp = true;
		},
		'enemy-builder'() {
			enemyBuilder = true;
		},
	};

	for (const arg of args) {
		if (arg === '-h') {
			showHelp = true;
			continue;
		}

		const parsedArg = parseCliArg(arg);
		if (parsedArg?.kind === 'kv') {
			const handler = kvHandlers[parsedArg.key];
			if (handler) {
				handler(parsedArg.value);
				continue;
			}
		}
		if (parsedArg?.kind === 'flag') {
			const handler = flagHandlers[parsedArg.key];
			if (handler) {
				handler();
				continue;
			}
		}

		if (!myFile) myFile = arg;
		else if (!enemyFile) enemyFile = arg;
	}

	if (myFile && mySaveFile) {
		throw new Error('Use either --my=<team.json> or --my-save=<savefile>, not both.');
	}

	if (showHelp || (packagedBinary && args.length === 0)) {
		console.log('Usage:');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json [--gen=sv]');
		console.log('  npm start -- --my=my-team.txt --enemy=enemy-team.txt [--gen=sv]');
		console.log('  npm start -- --my=my-team.json --enemy-builder');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --format=doubles');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --format=singles');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --mode=casual');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --mode=competitive');
		console.log('  npm start -- --my-save=/path/to/main.sav --enemy=enemy-team.json [--gen=sv]');
		console.log('  npm start -- --my=my-team.json --game=sv --trainer=nemona [--gen=9]');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --data-source=pokeapi');
		console.log('  npm start -- --my=my-team.json --against-trainer=sv:nemona');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --lookahead=3 --allow-switching --weather=rain --defensive-weight=0.3 --opponent-risk-weight=0.55');
		console.log('  npm start -- --tui');
		if (packagedBinary && args.length === 0) {
			console.log('');
			console.log('Tip: for the guided TUI, download a portable runtime build and run its launcher with no arguments.');
		}
		return;
	}

	if (launchTui) {
		if (packagedBinary) {
			throw new Error('TUI mode is not available in single-file binaries. Use a portable runtime build for the guided TUI, or pass CLI flags to this binary.');
		}
		await runTUI({ gen, myFile, mySaveFile, enemyFile, game, trainerName, dataSource, trainerSource, jsonOutput, evaluationOptions });
		return;
	}

	await loadData(gen, dataSource);
	let myTeam: PokemonSet[];
	if (mySaveFile) {
		myTeam = await loadTeamFromSaveFile(mySaveFile);
	} else if (!myFile) {
		myTeam = await promptForTeam();
	} else {
		myTeam = parseTeamInput(readFileSync(myFile, 'utf8'));
	}

	let enemyTeam: PokemonSet[];
	if (trainerName && game) {
		enemyTeam = await fetchTrainerTeamFromSource(trainerSource, game, trainerName);
	} else if (enemyFile) {
		enemyTeam = parseTeamInput(readFileSync(enemyFile, 'utf8'));
	} else if (enemyBuilder) {
		enemyTeam = await promptForTeam();
	} else {
		throw new Error('You must specify either --trainer and --game, provide an enemy team file via --enemy (JSON or Showdown text), or use --enemy-builder');
	}

	const result = evaluateTeams(myTeam, enemyTeam, evaluationOptions);
	if (jsonOutput) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		printResultsPretty(result);
	}
}
