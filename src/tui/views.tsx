import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { CliResult, PokemonSet } from '../types.js';
import type { EditorField, SetupQuestion } from './model.js';
import { formatPercent, getFieldValue, renderBar, renderPercentBar, scoreColor, statsToCsv, truncateText, wrapText } from './utils.js';

function renderWithInlineCode(value: string): React.ReactNode {
	const parts = value.split(/(`[^`]+`)/g).filter(Boolean);
	return parts.map((part, idx) => {
		if (part.startsWith('`') && part.endsWith('`')) {
			return (
				<Text key={`code-${idx}`} color="yellow" bold>
					{part.slice(1, -1)}
				</Text>
			);
		}
		return <React.Fragment key={`text-${idx}`}>{part}</React.Fragment>;
	});
}

type SetupViewProps = {
	setupIndex: number;
	setupQuestionsLength: number;
	activeQuestion?: SetupQuestion;
	error: string | null;
	statusMsg: string;
};

export function SetupView({ setupIndex, setupQuestionsLength, activeQuestion, error, statusMsg }: SetupViewProps): React.JSX.Element {
	return (
		<Box flexDirection="column" alignItems="center" justifyContent="center" height="100%" width="100%">
			<Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} flexDirection="column" width={88}>
				<Text bold color="cyan">Pokémon Matchup TUI Setup</Text>
				<Text dimColor>{`Step ${Math.min(setupIndex + 1, setupQuestionsLength)} of ${setupQuestionsLength}`}</Text>
				<Box marginTop={1}>
					<Text>{activeQuestion?.label ?? 'Loading...'}</Text>
				</Box>
				{activeQuestion?.kind === 'select' && activeQuestion.options ? (
					<Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
						{activeQuestion.options.map(opt => (
							<Text key={opt.value} color={activeQuestion.value === opt.value ? 'yellow' : undefined}>
								{activeQuestion.value === opt.value ? '▶ ' : '  '}{opt.label}
							</Text>
						))}
					</Box>
				) : (
					<Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
						{activeQuestion ? (
							<TextInput value={activeQuestion.value} onChange={activeQuestion.setValue} />
						) : (
							<Text>...</Text>
						)}
					</Box>
				)}
				<Box marginTop={1} flexDirection="column">
					<Text dimColor>Enter: next / confirm</Text>
					<Text dimColor>Selects: Up/Down changes option</Text>
					<Text dimColor>Left Arrow: previous question</Text>
					<Text dimColor>Esc / Ctrl+C: exit</Text>
				</Box>
				{error ? <Text color="red">Error: {error}</Text> : null}
				{statusMsg ? <Text color="green">{statusMsg}</Text> : null}
			</Box>
		</Box>
	);
}

type EditorViewProps = {
	editingSide: 'my' | 'enemy';
	myTeam: PokemonSet[];
	enemyTeam: PokemonSet[];
	selectedMyPokemon: number;
	selectedEnemyPokemon: number;
	selectedPokemon: number;
	selectedField: number;
	fields: readonly EditorField[];
	activePokemon: PokemonSet;
	editMode: boolean;
	editBuffer: string;
	setEditBuffer: (v: string) => void;
	savePrompt: boolean;
	savePath: string;
	setSavePath: (v: string) => void;
	statusMsg: string;
	error: string | null;
};

export function EditorView(props: EditorViewProps): React.JSX.Element {
	const {
		editingSide,
		myTeam,
		enemyTeam,
		selectedMyPokemon,
		selectedEnemyPokemon,
		selectedPokemon,
		selectedField,
		fields,
		activePokemon,
		editMode,
		editBuffer,
		setEditBuffer,
		savePrompt,
		savePath,
		setSavePath,
		statusMsg,
		error,
	} = props;

	return (
		<Box flexDirection="column" width="100%" height="100%">
			<Box flexGrow={1}>
				<Box width="30%" borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1}>
					<Text bold>Party {editingSide === 'my' ? '(editing)' : ''}</Text>
					{myTeam.map((mon, idx) => (
						<Text key={`${mon.species}-${idx}`} color={editingSide === 'my' && idx === selectedMyPokemon ? 'yellow' : undefined}>
							{editingSide === 'my' && idx === selectedMyPokemon ? '▶ ' : '  '}
							{idx + 1}. {mon.species} Lv{mon.level}
						</Text>
					))}
				</Box>
				<Box width="40%" borderStyle="round" borderColor="green" flexDirection="column" paddingX={1}>
					<Text bold>Step-by-step Config Editor</Text>
					<Text>Editing: {editingSide === 'my' ? 'Your team' : 'Enemy team'}</Text>
					<Text>Selected slot: {selectedPokemon + 1}</Text>
					<Text dimColor>IVs: {statsToCsv(activePokemon.ivs)}</Text>
					<Text dimColor>EVs: {statsToCsv(activePokemon.evs)}</Text>
					{fields.map((field, idx) => (
						<Text key={field} color={idx === selectedField ? 'yellow' : undefined}>
							{idx === selectedField ? '▶ ' : '  '}
							{field}: {getFieldValue(field, activePokemon) || '(empty)'}
						</Text>
					))}
					{editMode ? (
						<Box marginTop={1} borderStyle="single" borderColor="yellow" paddingX={1}>
							<TextInput value={editBuffer} onChange={setEditBuffer} />
						</Box>
					) : null}
					{savePrompt ? (
						<Box marginTop={1} borderStyle="single" borderColor="magenta" paddingX={1}>
							<Text>Save path: </Text>
							<TextInput value={savePath} onChange={setSavePath} />
						</Box>
					) : null}
				</Box>
				<Box width="30%" borderStyle="round" borderColor="blue" flexDirection="column" paddingX={1}>
					<Text bold>Opponent Team {editingSide === 'enemy' ? '(editing)' : ''}</Text>
					{enemyTeam.length === 0 ? <Text dimColor>No opponent loaded.</Text> : null}
					{enemyTeam.slice(0, 6).map((mon, idx) => (
						<Text key={`${mon.species}-${idx}`} color={editingSide === 'enemy' && idx === selectedEnemyPokemon ? 'yellow' : undefined}>
							{editingSide === 'enemy' && idx === selectedEnemyPokemon ? '▶ ' : '  '}
							{idx + 1}. {mon.species} Lv{mon.level}
						</Text>
					))}
				</Box>
			</Box>
			<Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
				<Text dimColor>Arrows: navigate | e: edit field | Enter: commit edit | Esc: cancel edit</Text>
				<Text dimColor>o: toggle side (my/enemy) | a: add slot | x: delete slot | p: estimate IV/EV | s: save active team JSON | c: calculate | q/Ctrl+C: quit</Text>
				{statusMsg ? <Text color="green">{statusMsg}</Text> : null}
				{error ? <Text color="red">Error: {error}</Text> : null}
			</Box>
		</Box>
	);
}

export function HelpView(): React.JSX.Element {
	return (
		<Box width="100%" height="100%" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1} flexDirection="column">
			<Text bold color="yellow">Matchup Interpretation Help</Text>
			<Text color="cyan">How to read each output</Text>
			<Text>{renderWithInlineCode('• `score`: net expected advantage over the lookahead window. Positive means your side is projected to come out ahead in HP exchange.')}</Text>
			<Text>{renderWithInlineCode('• `min/max damage %`: one-hit damage band against current target HP using in-game style 85%-100% random rolls.')}</Text>
			<Text>{renderWithInlineCode('• `1HKO/2HKO`: chance to KO in one or two attacks from roll+accuracy+status action checks.')}</Text>
			<Text>{renderWithInlineCode('• `speed+`: your side is expected to act first within the same priority bracket.')}</Text>
			<Text>{renderWithInlineCode('• `role`: heuristic tag (`cleaner`, `wallbreaker`, `wall`, `pivot`, `balanced`) to help draft a game plan.')}</Text>
			<Text>{renderWithInlineCode('• `notes`: tactical warnings/bonuses (speed tie, setup line discovered, hazard switch penalty).')}</Text>

			<Box marginTop={1}>
				<Text color="cyan">Battle-planning workflow</Text>
			</Box>
			<Text>{renderWithInlineCode('1) Identify your best 2-3 candidates into each enemy, not just rank #1.')}</Text>
			<Text>{renderWithInlineCode('2) If two picks are close, prioritize the one with better `speed+` or higher 2HKO reliability.')}</Text>
			<Text>3) If notes mention setup discovery, treat that line as a conditional win-path and check survival turn 1.</Text>
			<Text>4) Recalculate after changing weather/terrain/screens/hazards to compare alternate game states.</Text>
			<Text>5) Save party snapshots before major edits so you can A/B compare matchup matrices quickly.</Text>

			<Box marginTop={1}>
				<Text color="cyan">Practical thresholds</Text>
			</Box>
			<Text>{renderWithInlineCode('• `1HKO ≥ 70%`: strong immediate pressure.')}</Text>
			<Text>{renderWithInlineCode('• `2HKO ≥ 90%` with `speed+`: reliable cleaner/revenge line.')}</Text>
			<Text>{renderWithInlineCode('• Positive `score` but low KO odds: likely pivot/chip role rather than finisher role.')}</Text>
			<Text>{renderWithInlineCode('• Negative `score` with no setup notes: avoid as primary answer unless needed for utility.')}</Text>

			<Box marginTop={1}><Text dimColor>h: close help | b: back to editor | r: recompute | q: quit</Text></Box>
		</Box>
	);
}

export function ResultsView(
	{ results, error, selectedIndex = 0, expandedEnemyKey = null }: {
		results: CliResult | null;
		error: string | null;
		selectedIndex?: number;
		expandedEnemyKey?: string | null;
	},
): React.JSX.Element {
	const entries = Object.entries(results ?? {});
	return (
		<Box width="100%" height="100%" flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
			<Text bold color="green">Matchup Results</Text>
			<Text dimColor>Compact enemy cards • arrows: select • Enter/e: expand card • score bar uses fixed 0-100 scale</Text>
			{results ? (
				<Box flexWrap="wrap" marginTop={1}>
					{entries.map(([enemy, picks], idx) => {
						const [best, second, third] = picks;
						const isSelected = idx === selectedIndex;
						const isExpanded = expandedEnemyKey === enemy;
						const bestScorePct = best ? best.score * 100 : 0;
						const bestScoreMagnitudePct = Math.abs(bestScorePct);
						const bestScoreBar = renderPercentBar(Math.min(100, bestScoreMagnitudePct), 12);
						const scoreBarColor: 'green' | 'red' | undefined = bestScorePct <= 0 ? 'red' : (bestScorePct >= 100 ? 'green' : undefined);
						const scoreOverflowPct = Math.max(0, bestScoreMagnitudePct - 100);
						const twoHkoValue = best?.twoHkoChance ?? 0;
						const bestKoBar = renderBar(twoHkoValue, 12);
						const dmgMin = best?.minDamagePercent?.toFixed(1) ?? '-';
						const dmgMax = best?.maxDamagePercent?.toFixed(1) ?? '-';
						const altText = [second, third]
							.filter(Boolean)
							.map((p, i) => `#${i + 2} ${truncateText(p.pokemon, 20)} ${(p.score * 100).toFixed(0)}%`)
							.join(' | ');
						const notes = best?.notes ?? [];
						const gimmickNote = notes.find((note) => note.startsWith('Auto gimmick timing selected:'));
						const responseNote = notes.find((note) => note.startsWith('Opponent best response assumes:'));
						const primaryNote = gimmickNote ?? responseNote ?? notes[0] ?? 'No tactical note.';
						const secondaryNote = responseNote && responseNote !== primaryNote
							? responseNote
							: (gimmickNote && gimmickNote !== primaryNote ? gimmickNote : undefined);
						const wrappedPrimaryNote = wrapText(primaryNote, 44);
						const wrappedSecondaryNote = secondaryNote ? wrapText(secondaryNote, 44) : [];
						const confidence = best?.confidence ?? 'Low';
						const why = best?.rationale?.[0] ?? 'No rationale available.';
						const bestName = best ? truncateText(best.pokemon, 24) : '';

						return (
							<Box
								key={enemy}
								width={50}
								marginRight={1}
								marginBottom={1}
								borderStyle="single"
								borderColor={isSelected ? 'yellow' : 'cyan'}
								paddingX={1}
								flexDirection="column"
							>
								<Text bold color={isSelected ? 'yellow' : 'cyan'}>{isSelected ? `▶ ${enemy}` : enemy}</Text>
								{best ? (
									<>
										<Text color={scoreColor(best.score)}>
											#1 {bestName} {best.speedAdvantage ? '⚡' : ''} {best.role ? `(${best.role})` : ''}
										</Text>
										<Text dimColor>Move {truncateText(best.move ?? '(none)', 24)}</Text>
										<Text dimColor>Confidence {confidence}</Text>
										<Text dimColor>
											Score <Text color={scoreColor(best.score)}>{bestScorePct >= 0 ? '+' : ''}{bestScorePct.toFixed(1)}%</Text>{' '}
											{scoreBarColor ? <Text color={scoreBarColor}>[{bestScoreBar}]</Text> : <Text>[{bestScoreBar}]</Text>}
											{scoreOverflowPct > 0 ? <Text color={scoreBarColor ?? 'green'}> +{scoreOverflowPct.toFixed(1)}%</Text> : null}
										</Text>
										<Text dimColor>Dmg {dmgMin}-{dmgMax}% | 2HKO {formatPercent(best.twoHkoChance)} [{bestKoBar}]</Text>
										<Text dimColor>Why {truncateText(why, 44)}</Text>
									</>
								) : (
									<Text dimColor>No matchup data.</Text>
								)}
								<Text dimColor>Alts {truncateText(altText || '-', 46)}</Text>
								<Text color="magenta">Note {wrappedPrimaryNote[0]}</Text>
								{wrappedPrimaryNote.slice(1).map((line, lineIdx) => (
									<Text key={`${enemy}-note-${lineIdx}`} color="magenta">     {line}</Text>
								))}
								{wrappedSecondaryNote.length > 0 ? <Text color="magenta">Alt {wrappedSecondaryNote[0]}</Text> : null}
								{wrappedSecondaryNote.slice(1).map((line, lineIdx) => (
									<Text key={`${enemy}-note-alt-${lineIdx}`} color="magenta">    {line}</Text>
								))}
										{isExpanded ? (
											<>
												<Text dimColor>────────────────────────────────────────</Text>
												<Text>Details</Text>
												<Text dimColor>1HKO {formatPercent(best.oneHkoChance)} | 2HKO {formatPercent(best.twoHkoChance)} | Speed {best.speedAdvantage ? 'advantage' : 'neutral/disadvantage'}</Text>
												<Text dimColor>Role {best.role ?? 'balanced'} | Confidence {best.confidence ?? 'Low'}</Text>
												<Text>All tactical notes:</Text>
												{(best.notes && best.notes.length > 0 ? best.notes : ['No tactical notes.']).map((note, noteIdx) => {
													const wrapped = wrapText(note, 44);
													return (
														<React.Fragment key={`${enemy}-full-note-${noteIdx}`}>
															<Text color="magenta">• {wrapped[0]}</Text>
															{wrapped.slice(1).map((line, i) => <Text key={`${enemy}-full-note-${noteIdx}-${i}`} color="magenta">  {line}</Text>)}
														</React.Fragment>
													);
												})}
												<Text>Top lines:</Text>
												{picks.slice(0, 3).map((pick, pickIdx) => (
													<Text key={`${enemy}-pick-${pickIdx}`} dimColor>
														#{pickIdx + 1} {truncateText(pick.pokemon, 18)} | {truncateText(pick.move ?? '(none)', 14)} | {(pick.score * 100).toFixed(1)}%
													</Text>
												))}
											</>
										) : null}
							</Box>
						);
					})}
				</Box>
			) : <Text dimColor>No results available.</Text>}
			<Box marginTop={1}><Text dimColor>Arrows: select card | Enter/e: expand | h: fullscreen help | b: back | r: recompute | q/Ctrl+C: quit</Text></Box>
			{error ? <Text color="red">Error: {error}</Text> : null}
		</Box>
	);
}
