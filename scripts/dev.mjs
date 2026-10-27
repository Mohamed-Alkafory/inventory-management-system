#!/usr/bin/env node
/**
 * Start the backend and frontend together for local development.
 *
 * - Refuses to start when either required port is already occupied.
 * - Only stops the child process trees that this script started.
 * - Keeps the fixed ports in sync with vite.config.ts and backend/.env.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

const apps = [
  { name: "backend", port: 3010, dir: path.join(projectRoot, "backend"), script: "start:dev" },
  { name: "frontend", port: 5173, dir: path.join(projectRoot, "frontend"), script: "dev" },
];

/** Return the PID listening on a TCP port, or null when it is free. */
function findListeningPid(port) {
  try {
    if (isWindows) {
      const output = execFileSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" });
      for (const line of output.split(/\r?\n/)) {
        const columns = line.trim().split(/\s+/);
        // Proto  Local Address  Foreign Address  State  PID
        if (
          columns.length >= 5 &&
          columns[0].toUpperCase() === "TCP" &&
          columns[1].endsWith(`:${port}`) &&
          columns[3].toUpperCase() === "LISTENING"
        ) {
          return columns[4];
        }
      }
      return null;
    }

    const output = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    }).trim();
    return output ? output.split(/\s+/)[0] : null;
  } catch {
    return null;
  }
}

function spawnApp({ name, dir, script }) {
  const env = { ...process.env, FORCE_COLOR: "1" };
  const child = isWindows
    ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npm run ${script}`], {
        cwd: dir,
        env,
        stdio: "inherit",
      })
    : spawn("npm", ["run", script], {
        cwd: dir,
        env,
        stdio: "inherit",
        detached: true,
      });

  child.on("error", (error) => {
    console.error(`[${name}] failed to start: ${error.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      const reason = signal ? `signal ${signal}` : `code ${code ?? 1}`;
      console.error(`[${name}] stopped unexpectedly (${reason}). Shutting down the other app.`);
      shutdown(code ?? 1);
    }
  });

  return child;
}

/** Stop a process tree that this script started. */
function stopApp(child) {
  if (!child?.pid) return;

  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  try {
    // The child was spawned detached, so it leads its own process group.
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

let shuttingDown = false;
const children = [];

function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nStopping development servers...");
  for (const child of children) stopApp(child);
  setTimeout(() => process.exit(exitCode), 500).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("SIGHUP", () => shutdown(0));

function main() {
  const conflicts = apps
    .map((app) => ({ ...app, pid: findListeningPid(app.port) }))
    .filter((app) => app.pid !== null);

  if (conflicts.length > 0) {
    console.error("Cannot start: a required development port is already in use.");
    for (const { name, port, pid } of conflicts) {
      console.error(`  - ${name} port ${port} is in use by PID ${pid}`);
    }
    console.error("Stop the conflicting process, then run `npm run dev` again.");
    process.exitCode = 1;
    return;
  }

  console.log("Starting backend on http://localhost:3010 ...");
  children.push(spawnApp(apps[0]));
  console.log("Starting frontend on http://localhost:5173 ...");
  children.push(spawnApp(apps[1]));
  console.log("Development servers are running. Press Ctrl+C to stop both.");
}

main();
