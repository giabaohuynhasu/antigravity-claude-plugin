import fs from "fs/promises";
import { execSync } from "child_process";

async function verify() {
  const code = await fs.readFile("server.js", "utf-8");

  if (!code.includes('function runProcess(command, args, cwd = WORKSPACE_DIR, timeoutMs = 120000) {')) {
    throw new Error("runProcess helper missing");
  }

  if (code.includes('await runPowerShell(`& "${NLM_EXE}" query "${notebookId}" "${query.replace(/"/g, \'`"\')}"`)')) {
     throw new Error("NLM_EXE vulnerability not fixed");
  }

  if (!code.includes('const result = await runProcess(NLM_EXE, ["query", notebookId, query]);')) {
     throw new Error("NLM_EXE fix is incorrect");
  }

  if (!code.includes('const result = await runProcess(PYTHON_EXE, ["-c", code]);')) {
     throw new Error("PYTHON_EXE calc fix is incorrect");
  }

  if (!code.includes('const result = await runProcess(PYTHON_EXE, ["-c", script]);')) {
     throw new Error("PYTHON_EXE script fix is incorrect");
  }

  console.log("All structural verifications passed!");
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
