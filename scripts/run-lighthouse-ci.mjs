import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const RETRYABLE_PATTERNS = [/CHROME_INTERSTITIAL_ERROR/, /chrome-error:\/\/chromewebdata\//];
const maxAttempts = Number.parseInt(process.env.LHCI_MAX_ATTEMPTS ?? '3', 10);
const retryDelayMs = Number.parseInt(process.env.LHCI_RETRY_DELAY_MS ?? '3000', 10);
const outputBufferLimit = 200_000;

async function runLighthouseAttempt(attempt) {
  console.log(`[lhci] Attempt ${attempt}/${maxAttempts}`);

  return new Promise((resolve) => {
    const child = spawn('npx', ['@lhci/cli', 'autorun', '--config=.lighthouserc.json'], {
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let combinedOutput = '';

    const onData = (chunk, writeTo) => {
      const text = chunk.toString();
      writeTo.write(text);
      combinedOutput += text;
      if (combinedOutput.length > outputBufferLimit) {
        combinedOutput = combinedOutput.slice(-outputBufferLimit);
      }
    };

    child.stdout.on('data', (chunk) => onData(chunk, process.stdout));
    child.stderr.on('data', (chunk) => onData(chunk, process.stderr));

    child.on('error', (error) => {
      resolve({
        code: 1,
        output: `spawn-error: ${error instanceof Error ? error.message : String(error)}`
      });
    });

    child.on('close', (code) => {
      resolve({
        code: typeof code === 'number' ? code : 1,
        output: combinedOutput
      });
    });
  });
}

function isRetryableFailure(output) {
  return RETRYABLE_PATTERNS.some((pattern) => pattern.test(output));
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = await runLighthouseAttempt(attempt);

  if (result.code === 0) {
    process.exit(0);
  }

  const retryable = isRetryableFailure(result.output);
  const hasAttemptsRemaining = attempt < maxAttempts;

  if (!retryable || !hasAttemptsRemaining) {
    process.exit(result.code);
  }

  console.log(`[lhci] Transient interstitial failure detected. Retrying in ${retryDelayMs}ms...`);
  await sleep(retryDelayMs);
}
