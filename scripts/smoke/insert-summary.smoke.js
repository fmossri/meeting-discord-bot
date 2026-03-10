#!/usr/bin/env node
/**
 * Smoke test: insert summary into an existing markdown report.
 *
 * Behavior:
 * - Reads `scripts/smoke/report-smoke.md` (your source report).
 * - Inserts a very clearly marked Summary section immediately before ```text.
 * - Writes back to the same file (in-place).
 *
 * Run:
 *   node scripts/smoke/insert-summary.smoke.js
 *
 * After running, open:
 *   scripts/smoke/report-smoke.md
 *
 * To manually remove the inserted section:
 * - Delete everything from the line "## Summary" down to and including the line
 *   "<!-- SMOKE_TEST_SUMMARY_END -->"
 *
 * Note:
 * - This smoke test does NOT auto-cleanup. If you run it twice without removing
 *   the block, it will fail with a clear error message.
 */

const fs = require('node:fs');
const path = require('node:path');

const { createReportGenerator } = require('../../services/report-generator/report-generator.js');

const ROOT = path.join(__dirname, '..', '..');
const WORK_PATH = path.join(ROOT, 'scripts', 'smoke', 'report-smoke.md');

const START_MARKER = '<!-- SMOKE_TEST_SUMMARY_START -->';
const END_MARKER = '<!-- SMOKE_TEST_SUMMARY_END -->';

const SUMMARY_TEXT = [
	START_MARKER,
	'',
	'THIS IS A SMOKE-TEST SUMMARY SECTION.',
	'You can safely delete this whole block after testing.',
	'',
	'- Bullet 1: Summary insertion works',
	'- Bullet 2: It lands before the transcript fence',
	'',
	END_MARKER,
].join('\n');

function assertWorkFileExists() {
	if (!fs.existsSync(WORK_PATH)) {
		throw new Error(
			`Missing ${WORK_PATH}. Create it with a header + participants + \`\`\`text fence, then re-run.`
		);
	}
}

function assertNoPriorSmokeSummary(markdown) {
	if (markdown.includes(START_MARKER) || markdown.includes(END_MARKER)) {
		throw new Error(
			[
				'Smoke-test summary markers already present in report-smoke.md.',
				'Please manually remove the block (from "## Summary" through "<!-- SMOKE_TEST_SUMMARY_END -->") and re-run.',
			].join(' ')
		);
	}
}

async function main() {
	assertWorkFileExists();
	const current = fs.readFileSync(WORK_PATH, 'utf8');
	assertNoPriorSmokeSummary(current);

	const reportGen = createReportGenerator({ fsImpl: fs, pathImpl: path });
	await reportGen.insertSummary(WORK_PATH, SUMMARY_TEXT);

	// Minimal console output so it’s easy to find the file.
	console.log(`Smoke test complete. Updated report: ${WORK_PATH}`);
}

main().catch((err) => {
	console.error('Smoke test failed:', err);
	process.exitCode = 1;
});

