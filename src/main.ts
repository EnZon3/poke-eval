import { runCli } from './cli.js';

runCli().catch(err => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
