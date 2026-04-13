import { DATA_CACHE } from '../data.js';
import { buildPokemon } from '../pokemon.js';
import { evaluate2v2 } from './doubles.js';
import { buildRationale, confidenceFromSignals, hazardSwitchInFraction } from './helpers.js';
import { evaluate1v1 } from './singles.js';
import type { BattlePokemon, EvaluationOptions, MatchupEvaluation, PokemonSet } from '../types.js';

export { hazardSwitchInFraction } from './helpers.js';

type PokemonVariant = {
	pokemon: BattlePokemon;
	tag: string;
};

function pairIndexCombinations(size: number): Array<[number, number]> {
	const pairs: Array<[number, number]> = [];
	for (let i = 0; i < size; i++) {
		for (let j = i + 1; j < size; j++) {
			pairs.push([i, j]);
		}
	}
	if (pairs.length === 0 && size === 1) pairs.push([0, 0]);
	return pairs;
}

function sameVariant(a: BattlePokemon, b: BattlePokemon): boolean {
	return a.species.name === b.species.name
		&& a.ability === b.ability
		&& a.teraType === b.teraType
		&& !!a.dynamax === !!b.dynamax
		&& a.stats.hp === b.stats.hp;
}

function activeVariantTag(base: BattlePokemon, active: BattlePokemon): string {
	const tags: string[] = [];
	if (active.species.name !== base.species.name && active.megaForm) tags.push(active.megaForm);
	if (!base.dynamax && active.dynamax) tags.push('Dynamax');
	if (!base.teraType && active.teraType) tags.push(`Tera ${active.teraType}`);
	if (base.teraType && active.teraType && base.teraType !== active.teraType) tags.push(`Tera ${active.teraType}`);
	return tags.join(' + ') || 'gimmick active';
}

function buildVariants(set: PokemonSet, options: EvaluationOptions): PokemonVariant[] {
	const disableBattleGimmicks = options.mechanicsPolicy === 'disable-all';
	if (options.gimmickControl !== 'auto') {
		return [{ pokemon: buildPokemon(set, { disableBattleGimmicks }), tag: 'manual' }];
	}
	const base = buildPokemon(set, { disableBattleGimmicks, forceGimmicksInactive: true });
	const active = buildPokemon(set, { disableBattleGimmicks });
	if (sameVariant(base, active)) {
		return [{ pokemon: base, tag: 'base' }];
	}
	return [
		{ pokemon: base, tag: 'base' },
		{ pokemon: active, tag: activeVariantTag(base, active) },
	];
}

export function evaluateTeams(
	myTeam: PokemonSet[],
	enemyTeam: PokemonSet[],
	options: EvaluationOptions = {},
): Record<string, MatchupEvaluation[]> {
	if (!DATA_CACHE.species || !DATA_CACHE.moves) {
		throw new Error('Data not loaded; call loadData() first');
	}
	const myVariantsBySlot = myTeam.map((set) => buildVariants(set, options));
	const enemyVariantsBySlot = enemyTeam.map((set) => buildVariants(set, options));
	const results: Record<string, MatchupEvaluation[]> = {};
	const battleFormat = options.battleFormat ?? 'singles';

	if (battleFormat === 'doubles') {
		const myPairs = pairIndexCombinations(myTeam.length);
		const enemyPairs = pairIndexCombinations(enemyTeam.length);
		for (const [enemyA, enemyB] of enemyPairs) {
			const enemyKey = `${enemyTeam[enemyA]?.species ?? 'Unknown'} + ${enemyTeam[enemyB]?.species ?? 'Unknown'}`;
			const enemyPairVariants: Array<{ pair: [BattlePokemon, BattlePokemon]; tag: string }> = [];
			for (const va of enemyVariantsBySlot[enemyA]) {
				for (const vb of enemyVariantsBySlot[enemyB]) {
					enemyPairVariants.push({ pair: [va.pokemon, vb.pokemon], tag: [va.tag, vb.tag].filter((t) => t !== 'base').join(' + ') });
				}
			}

			const evaluations: MatchupEvaluation[] = [];
			for (const [myA, myB] of myPairs) {
				const myPairVariants: Array<{ pair: [BattlePokemon, BattlePokemon]; tag: string }> = [];
				for (const va of myVariantsBySlot[myA]) {
					for (const vb of myVariantsBySlot[myB]) {
						myPairVariants.push({ pair: [va.pokemon, vb.pokemon], tag: [va.tag, vb.tag].filter((t) => t !== 'base').join(' + ') });
					}
				}

				let bestChoice: {
					duel: ReturnType<typeof evaluate2v2>;
					score: number;
					notes: string[];
					myTag: string;
					enemyTag: string;
				} | null = null;

				for (const myVariant of myPairVariants) {
					let worst: {
						duel: ReturnType<typeof evaluate2v2>;
						score: number;
						notes: string[];
						enemyTag: string;
					} | null = null;
					for (const enemyVariant of enemyPairVariants) {
						const duel = evaluate2v2(myVariant.pair, enemyVariant.pair, options);
						let score = duel.score;
						const notes = [...duel.notes];
						if (options.allowSwitching) {
							const hazardPenalty = hazardSwitchInFraction(myVariant.pair[0], options.battleState?.mySide)
								+ hazardSwitchInFraction(myVariant.pair[1], options.battleState?.mySide);
							if (hazardPenalty > 0) {
								score -= hazardPenalty;
								notes.push(`Lead switch-in hazards estimate: ${(hazardPenalty * 100).toFixed(1)}% combined HP loss.`);
							}
						}
						if (!worst || score < worst.score) {
							worst = { duel, score, notes, enemyTag: enemyVariant.tag };
						}
					}
					if (worst && (!bestChoice || worst.score > bestChoice.score)) {
						bestChoice = { ...worst, myTag: myVariant.tag };
					}
				}
				if (!bestChoice) continue;

				const notes = [...bestChoice.notes];
				if (options.gimmickControl === 'auto' && bestChoice.myTag) notes.push(`Auto gimmick timing selected: ${bestChoice.myTag}.`);
				if (options.gimmickControl === 'auto' && bestChoice.enemyTag) notes.push(`Opponent best response assumes: ${bestChoice.enemyTag}.`);

				const confidence = confidenceFromSignals(bestChoice.score, bestChoice.duel.profile, notes);
				if (options.allowSwitching) {
					// already applied in branch scoring
				}
				evaluations.push({
					pokemon: bestChoice.duel.pairName,
					move: bestChoice.duel.moveSummary,
					score: bestChoice.score,
					minDamagePercent: bestChoice.duel.profile ? bestChoice.duel.profile.min : undefined,
					maxDamagePercent: bestChoice.duel.profile ? bestChoice.duel.profile.max : undefined,
					oneHkoChance: bestChoice.duel.profile?.oneHkoChance,
					twoHkoChance: bestChoice.duel.profile?.twoHkoChance,
					speedAdvantage: bestChoice.duel.speedAdvantage,
					role: bestChoice.duel.role,
					confidence,
					rationale: buildRationale({
						profile: bestChoice.duel.profile,
						score: bestChoice.score,
						speedAdvantage: bestChoice.duel.speedAdvantage,
						role: bestChoice.duel.role,
						confidence,
					}),
					notes,
				});
			}
			evaluations.sort((a, b) => b.score - a.score);
			results[enemyKey] = evaluations;
		}
		return results;
	}

	for (let enemyIndex = 0; enemyIndex < enemyTeam.length; enemyIndex++) {
		const enemyVariants = enemyVariantsBySlot[enemyIndex];
		const enemyKey = enemyTeam[enemyIndex]?.species ?? enemyVariants[0]?.pokemon.species.name ?? `Enemy ${enemyIndex + 1}`;
		const evaluations: MatchupEvaluation[] = [];
		for (let myIndex = 0; myIndex < myTeam.length; myIndex++) {
			const myVariants = myVariantsBySlot[myIndex];
			let bestChoice: {
				duel: ReturnType<typeof evaluate1v1>;
				score: number;
				notes: string[];
				mine: BattlePokemon;
				enemy: BattlePokemon;
				myTag: string;
				enemyTag: string;
			} | null = null;

			for (const myVariant of myVariants) {
				let worst: {
					duel: ReturnType<typeof evaluate1v1>;
					score: number;
					notes: string[];
					enemy: BattlePokemon;
					enemyTag: string;
				} | null = null;
				for (const enemyVariant of enemyVariants) {
					const duel = evaluate1v1(myVariant.pokemon, enemyVariant.pokemon, options);
					let score = duel.score;
					const notes = [...duel.notes];
					if (options.allowSwitching) {
						const hazardPenalty = hazardSwitchInFraction(myVariant.pokemon, options.battleState?.mySide);
						if (hazardPenalty > 0) {
							score -= hazardPenalty;
							notes.push(`Switch-in hazards estimate: ${(hazardPenalty * 100).toFixed(1)}% HP loss.`);
						}
					}
					if (!worst || score < worst.score) {
						worst = { duel, score, notes, enemy: enemyVariant.pokemon, enemyTag: enemyVariant.tag };
					}
				}
				if (worst && (!bestChoice || worst.score > bestChoice.score)) {
					bestChoice = {
						duel: worst.duel,
						score: worst.score,
						notes: worst.notes,
						mine: myVariant.pokemon,
						enemy: worst.enemy,
						myTag: myVariant.tag,
						enemyTag: worst.enemyTag,
					};
				}
			}
			if (!bestChoice) continue;
			const notes = [...bestChoice.notes];
			if (options.gimmickControl === 'auto' && bestChoice.myTag !== 'base') notes.push(`Auto gimmick timing selected: ${bestChoice.myTag}.`);
			if (options.gimmickControl === 'auto' && bestChoice.enemyTag) notes.push(`Opponent best response assumes: ${bestChoice.enemyTag}.`);
			const confidence = confidenceFromSignals(bestChoice.score, bestChoice.duel.profile, notes);

			evaluations.push({
				pokemon: bestChoice.mine.species.name,
				move: bestChoice.duel.bestMove?.name,
				score: bestChoice.score,
				minDamagePercent: bestChoice.duel.profile ? (bestChoice.duel.profile.min / bestChoice.enemy.stats.hp) * 100 : undefined,
				maxDamagePercent: bestChoice.duel.profile ? (bestChoice.duel.profile.max / bestChoice.enemy.stats.hp) * 100 : undefined,
				oneHkoChance: bestChoice.duel.profile?.oneHkoChance,
				twoHkoChance: bestChoice.duel.profile?.twoHkoChance,
				speedAdvantage: bestChoice.duel.speedAdvantage,
				role: bestChoice.duel.role,
				confidence,
				rationale: buildRationale({
					profile: bestChoice.duel.profile,
					score: bestChoice.score,
					speedAdvantage: bestChoice.duel.speedAdvantage,
					role: bestChoice.duel.role,
					confidence,
				}),
				notes,
			});
		}
		evaluations.sort((a, b) => b.score - a.score);
		results[enemyKey] = evaluations;
	}
	return results;
}
