// Local, one-off password hasher.
//
//     npm run hash-password
//
// It prompts for a password with the echo turned off, prints the bcrypt hash
// and nothing else, and exits. The password is never written to a file, never
// printed, never logged, and never put into an argument (so it stays out of
// your shell history and out of `ps`). Copy the printed hash into `.env`.
//
// Run it once per account: the output of the first run goes in
// AUTH_PASSWORD_HASH_1, the second in AUTH_PASSWORD_HASH_2.

import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";

/** bcrypt work factor. 12 is ~0.25s per attempt on current hardware. */
const COST = 12;
const MIN_LENGTH = 10;

/**
 * One readline interface serves both prompts. Opening a second one on the same
 * stdin after closing the first leaves the stream paused, and the second
 * prompt then never resolves.
 */
function createPrompter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const echo = rl._writeToOutput.bind(rl);
  let current = "";

  // readline writes every keystroke back to the terminal. Swallow all of it
  // except the prompt itself, so the password leaves no trace on screen.
  rl._writeToOutput = (chunk) => {
    if (current && chunk.includes(current)) echo(current);
  };

  return {
    ask(prompt) {
      current = prompt;
      return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
          process.stdout.write("\n");
          resolve(answer);
        });
      });
    },
    close() {
      rl.close();
    },
  };
}

async function main() {
  if (!process.stdin.isTTY) {
    throw new Error("Run this in a terminal — the prompt needs a TTY to hide what you type.");
  }

  process.stdout.write("\nGenerate a bcrypt hash for one dashboard account.\n");
  process.stdout.write("Typing is hidden. The password is not stored anywhere.\n\n");

  const prompter = createPrompter();
  let password = "";
  let confirmation = "";
  try {
    password = await prompter.ask("Password: ");

    if (password.length < MIN_LENGTH) {
      // Say the rule, never the value.
      process.stderr.write(
        `\nPassword must be at least ${MIN_LENGTH} characters. Nothing written.\n`,
      );
      process.exitCode = 1;
      return;
    }

    confirmation = await prompter.ask("Confirm password: ");
  } finally {
    prompter.close();
  }

  if (password !== confirmation) {
    process.stderr.write("\nThe two entries did not match. Nothing written.\n");
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, COST);

  // Drop the plain text before anything else can touch it.
  password = "";
  confirmation = "";

  process.stdout.write("\nGenerated hash — copy the line below into .env:\n\n");
  process.stdout.write(`${hash}\n\n`);
}

main().catch((err) => {
  process.stderr.write(`\n${err?.message ?? err}\n`);
  process.exitCode = 1;
});
