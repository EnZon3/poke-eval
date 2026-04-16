import { parseGeneration } from '../utils.js';
import type { SetupQuestion, SetupState } from './model.js';

export function buildSetupQuestions(
	setup: SetupState,
	setSetup: (updater: (prev: SetupState) => SetupState) => void,
): SetupQuestion[] {
	const questions: SetupQuestion[] = [
		{
			id: 'gen',
			label: 'Generation (1-9; blank latest)',
			kind: 'text',
			value: setup.genInput,
			setValue: v => setSetup((prev) => ({ ...prev, genInput: v })),
			validate: v => (v.trim() === '' || parseGeneration(v) ? null : 'Invalid generation input.'),
		},
		{
			id: 'battleFormat',
			label: 'Battle format',
			kind: 'select',
			value: setup.battleFormat,
			setValue: v => setSetup((prev) => ({ ...prev, battleFormat: v === 'doubles' ? 'doubles' : 'singles' })),
			options: [
				{ label: 'Singles (1v1 matrix)', value: 'singles' },
				{ label: 'Doubles (2v2 leads)', value: 'doubles' },
			],
		},
		{
			id: 'mechanicsPolicy',
			label: 'Battle gimmicks (Mega/Dynamax/Tera)',
			kind: 'select',
			value: setup.mechanicsPolicy,
			setValue: v => setSetup((prev) => ({ ...prev, mechanicsPolicy: v === 'disable-all' ? 'disable-all' : 'generation-default' })),
			options: [
				{ label: 'Default by generation', value: 'generation-default' },
				{ label: 'Disable all battle gimmicks', value: 'disable-all' },
			],
		},
		{
			id: 'gimmickControl',
			label: 'Gimmick timing control',
			kind: 'select',
			value: setup.gimmickControl,
			setValue: v => setSetup((prev) => ({ ...prev, gimmickControl: v === 'auto' ? 'auto' : 'manual' })),
			options: [
				{ label: 'Manual (team flags)', value: 'manual' },
				{ label: 'Auto (engine timing)', value: 'auto' },
			],
		},
		{
			id: 'mode',
			label: 'Recommendation mode',
			kind: 'select',
			value: setup.mode,
			setValue: v => setSetup((prev) => ({ ...prev, mode: v === 'competitive' ? 'competitive' : (v === 'custom' ? 'custom' : 'casual') })),
			options: [
				{ label: 'Casual (clear)', value: 'casual' },
				{ label: 'Competitive (risk-aware)', value: 'competitive' },
				{ label: 'Custom (CLI flags)', value: 'custom' },
			],
		},
		{
			id: 'dataSource',
			label: 'Data source',
			kind: 'select',
			value: setup.dataSource,
			setValue: v => setSetup((prev) => ({ ...prev, dataSource: v === 'pokeapi' ? 'pokeapi' : 'showdown' })),
			options: [
				{ label: 'Pokémon Showdown data', value: 'showdown' },
				{ label: 'PokeAPI species', value: 'pokeapi' },
			],
		},
		{
			id: 'mySource',
			label: 'Your team source',
			kind: 'select',
			value: setup.mySource,
			setValue: v => setSetup((prev) => ({ ...prev, mySource: v === 'json' ? 'json' : (v === 'save' ? 'save' : 'builder') })),
			options: [
				{ label: 'Build interactively (teambuilder)', value: 'builder' },
				{ label: 'Load from team file (JSON/Showdown)', value: 'json' },
				{ label: 'Load from save file', value: 'save' },
			],
		},
	];

	if (setup.mySource === 'json') {
		questions.push({
			id: 'myFile',
			label: 'Your team file (.json/.txt)',
			kind: 'text',
			value: setup.myFile,
			setValue: v => setSetup((prev) => ({ ...prev, myFile: v })),
			validate: v => (v.trim() ? null : 'Please provide a file path.'),
		});
	}

	if (setup.mySource === 'save') {
		questions.push({
			id: 'mySaveFile',
			label: 'Your save file (.sav/.dat)',
			kind: 'text',
			value: setup.mySaveFile,
			setValue: v => setSetup((prev) => ({ ...prev, mySaveFile: v })),
			validate: v => (v.trim() ? null : 'Please provide a save-file path.'),
		});
	}

	questions.push({
		id: 'enemySource',
		label: 'Opponent source',
		kind: 'select',
		value: setup.enemySource,
		setValue: v => setSetup((prev) => ({ ...prev, enemySource: v === 'trainer' ? 'trainer' : (v === 'builder' ? 'builder' : 'json') })),
		options: [
			{ label: 'Load opponent file (JSON/Showdown)', value: 'json' },
			{ label: 'Use trainer roster', value: 'trainer' },
			{ label: 'Build opponent team', value: 'builder' },
		],
	});

	if (setup.enemySource === 'json') {
		questions.push({
			id: 'enemyFile',
			label: 'Opponent team file (.json/.txt)',
			kind: 'text',
			value: setup.enemyFile,
			setValue: v => setSetup((prev) => ({ ...prev, enemyFile: v })),
			validate: v => (v.trim() ? null : 'Please provide a file path.'),
		});
	}

	if (setup.enemySource === 'trainer') {
		questions.push(
			{
				id: 'game',
				label: 'Game code (sv/swsh/xy)',
				kind: 'text',
				value: setup.game,
				setValue: v => setSetup((prev) => ({ ...prev, game: v })),
				validate: v => (v.trim() ? null : 'Please provide a game code.'),
			},
			{
				id: 'trainer',
				label: 'Trainer name',
				kind: 'text',
				value: setup.trainerName,
				setValue: v => setSetup((prev) => ({ ...prev, trainerName: v })),
				validate: v => (v.trim() ? null : 'Please provide a trainer name.'),
			},
		);
	}

	return questions;
}
