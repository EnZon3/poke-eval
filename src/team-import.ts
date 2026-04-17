import { readFileSync } from 'node:fs';
export { parseShowdownTeam } from './team-import/showdown.js';
export { parseTeamInput } from './team-import/input.js';
import { parseTeamInput } from './team-import/input.js';

export function loadTeamInputFile(filePath: string) {
	return parseTeamInput(readFileSync(filePath, 'utf8'));
}
