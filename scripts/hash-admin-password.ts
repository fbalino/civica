/**
 * admin:set-password — generate an ADMIN_PASSWORD_HASH value.
 *
 * Hashes an admin password with the same salted scrypt KDF the sign-in
 * route verifies against (`src/lib/admin/password.ts`) and prints the
 * `scrypt$...` value to paste into `.env.local` (and Vercel) as
 * ADMIN_PASSWORD_HASH. The plaintext is NEVER written to disk or echoed
 * back.
 *
 * Usage:
 *   # Interactive (recommended — no shell-history leak, input hidden):
 *   npm run admin:set-password
 *
 *   # Pipe a password in (e.g. from a password manager):
 *   printf '%s' 'my-strong-password' | npm run admin:set-password
 *
 *   # Argv (LEAST private — the password lands in shell history):
 *   npm run admin:set-password -- 'my-strong-password'
 *
 * Output is the single ADMIN_PASSWORD_HASH=... line plus a short note on
 * the two companion env vars (ADMIN_USERNAME, ADMIN_SESSION_SECRET).
 */

import { createInterface } from "node:readline";
import { hashPassword } from "../src/lib/admin/password";

const MIN_LENGTH = 10;

/** Read a password from argv, then piped stdin, then an interactive
 *  hidden prompt. Returns the raw string (untrimmed — a password may
 *  legitimately contain leading/trailing spaces). */
async function readPassword(): Promise<string> {
  // 1) argv (everything after `--`)
  const argvPassword = process.argv.slice(2).join(" ");
  if (argvPassword) return argvPassword;

  // 2) piped stdin (non-TTY)
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    // Strip a single trailing newline (printf/echo, pipes) but keep the
    // rest of the input verbatim.
    return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
  }

  // 3) interactive hidden prompt
  return promptHidden("New admin password: ");
}

/** Prompt on a TTY without echoing the typed characters. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Mute the output stream so keystrokes aren't echoed.
    const originalWrite = (
      process.stdout as NodeJS.WriteStream & {
        write: (chunk: string) => boolean;
      }
    ).write.bind(process.stdout);
    let muted = false;
    (process.stdout as unknown as { write: (chunk: string) => boolean }).write =
      (chunk: string): boolean => {
        if (muted && chunk !== "\n" && chunk !== "\r\n") return true;
        return originalWrite(chunk);
      };

    process.stdout.write(question);
    muted = true;

    rl.question("", (answer) => {
      muted = false;
      (
        process.stdout as unknown as { write: (chunk: string) => boolean }
      ).write = originalWrite;
      process.stdout.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const password = await readPassword();

  if (!password) {
    console.error(
      "No password provided. Pass one as an argument, pipe it in, or type it at the prompt.",
    );
    process.exit(1);
  }

  if (password.length < MIN_LENGTH) {
    console.error(
      `Password too short (${password.length} chars). Use at least ${MIN_LENGTH}.`,
    );
    process.exit(1);
  }

  const hash = await hashPassword(password);

  // Print ONLY the hash line to stdout so it's easy to copy / redirect.
  // Guidance goes to stderr so `... | pbcopy` grabs just the value.
  process.stdout.write(`ADMIN_PASSWORD_HASH=${hash}\n`);

  console.error(
    [
      "",
      "Paste the line above into .env.local (and set it in Vercel).",
      "It is a one-way scrypt hash — the plaintext is not recoverable from it.",
      "",
      "The admin login also needs these two env vars set:",
      "  ADMIN_USERNAME        the login username (plaintext)",
      "  ADMIN_SESSION_SECRET  cookie-signing secret — generate with:",
      "                          openssl rand -hex 32",
      "",
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error("Failed to hash password:", err);
  process.exit(1);
});
