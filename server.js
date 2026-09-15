/**
 * Antigravity MCP Server (Production Node/TypeScript Standard)
 * Author: Gia Bao Huynh (Jun) · Co-Author: Claude Sonnet 5
 * Standard: MCP Server Development Guide (mcp-builder Gold Standard)
 * Transport: StdioServerTransport
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

// Configuration Constants
const WORKSPACE_DIR = "C:\\Users\\nswcl\\.gemini\\antigravity-ide\\scratch";
const VAULT_DIR = "C:\\Users\\nswcl\\OneDrive\\Documents\\Obsidian Vault";
const CLAUDE_USER_DIR = "C:\\Users\\nswcl\\Claude";
const PYTHON_EXE = "C:\\Users\\nswcl\\.gemini\\antigravity-ide\\scratch\\.venv\\Scripts\\python.exe";
const NLM_EXE = "C:\\Users\\nswcl\\.local\\bin\\nlm.exe";

// Initialize MCP Server
const server = new McpServer({
  name: "antigravity-copilot",
  version: "1.0.0"
});

// Daemon State
let duckDbDaemon = null;
const duckDbRequestQueue = [];

function getDuckDbDaemon() {
  if (!duckDbDaemon) {
    const script = `
import sys
import base64
import json
import duckdb

try:
    con = duckdb.connect()
except Exception as e:
    sys.exit(f"DuckDB init error: {e}")

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        query = base64.b64decode(line).decode('utf-8')
        df = con.execute(query).df()
        output = df.to_markdown(index=False) if hasattr(df, 'to_markdown') else df.to_string(index=False)
        result = {"status": "success", "data": output}
    except Exception as e:
        result = {"status": "error", "error": str(e)}

    print(base64.b64encode(json.dumps(result).encode('utf-8')).decode('utf-8'))
    sys.stdout.flush()
`;

    duckDbDaemon = spawn(PYTHON_EXE, ["-c", script], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" }
    });

    let buffer = "";
    duckDbDaemon.stdout.on("data", (data) => {
      buffer += data.toString("utf-8");
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          try {
            const decoded = Buffer.from(line, 'base64').toString('utf-8');
            const result = JSON.parse(decoded);
            const req = duckDbRequestQueue.shift();
            if (req) {
              if (result.status === "success") {
                req.resolve(result.data);
              } else {
                req.reject(new Error(result.error));
              }
            }
          } catch (err) {
            console.error("Failed to parse daemon response:", err);
          }
        }
      }
    });

    duckDbDaemon.stderr.on("data", (data) => {
      console.error("[DuckDB Daemon Error]:", data.toString());
    });

    duckDbDaemon.on("close", () => {
      duckDbDaemon = null;
      while (duckDbRequestQueue.length > 0) {
        duckDbRequestQueue.shift().reject(new Error("Daemon closed unexpectedly"));
      }
    });
  }
  return duckDbDaemon;
}

// Helper for command execution
function runPowerShell(command, cwd = WORKSPACE_DIR, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
      cwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      timeout: timeoutMs
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString("utf-8");
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString("utf-8");
    });

    child.on("close", (code) => {
      const output = stdout.trim();
      const err = stderr.trim();
      if (code === 0) {
        resolve(output || "[Command finished successfully with no stdout]");
      } else {
        resolve(`[Exit Code ${code}]\n${output}\n${err ? "STDERR:\n" + err : ""}`);
      }
    });

    child.on("error", (err) => {
      resolve(`[Process Error]: ${err.message}`);
    });
  });
}

// Tool 1: Run Python Code in Research .venv
server.tool(
  "antigravity_python_calc",
  {
    code: z.string().describe("Python 3.14 code to execute. Has access to numpy, scipy, pandas, duckdb, boto3, sympy, matplotlib.")
  },
  async ({ code }) => {
    const escapedCode = code.replace(/"/g, '\\"');
    const result = await runPowerShell(`& "${PYTHON_EXE}" -c "${escapedCode}"`);
    return {
      content: [{ type: "text", text: result }]
    };
  }
);

// Tool 2: Execute PowerShell Terminal Command
server.tool(
  "antigravity_terminal_exec",
  {
    command: z.string().describe("PowerShell command to execute in the Antigravity research workspace.")
  },
  async ({ command }) => {
    const result = await runPowerShell(command);
    return {
      content: [{ type: "text", text: result }]
    };
  }
);

// Tool 3: Read Research Files
server.tool(
  "antigravity_read_file",
  {
    filePath: z.string().describe("Relative or absolute path to read from Antigravity workspace, Claude folder, or Obsidian Vault.")
  },
  async ({ filePath }) => {
    let resolved = path.isAbsolute(filePath) ? filePath : path.join(WORKSPACE_DIR, filePath);
    try {
      await fs.access(resolved);
    } catch {
      // Check in Obsidian Vault
      const vaultPath = path.join(VAULT_DIR, filePath);
      try {
        await fs.access(vaultPath);
        resolved = vaultPath;
      } catch {
        // Check in Claude folder
        const claudePath = path.join(CLAUDE_USER_DIR, filePath);
        try {
          await fs.access(claudePath);
          resolved = claudePath;
        } catch {
          return {
            content: [{ type: "text", text: `[Error: File not found in workspace, vault, or Claude folder: ${filePath}]` }],
            isError: true
          };
        }
      }
    }

    try {
      const data = await fs.readFile(resolved, "utf-8");
      return {
        content: [{ type: "text", text: data }]
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: `[Read Error: ${e.message}]` }],
        isError: true
      };
    }
  }
);

// Tool 4: Write Research Files
server.tool(
  "antigravity_write_file",
  {
    filePath: z.string().describe("Path to save/update in Antigravity workspace, Claude folder, or Obsidian Vault."),
    content: z.string().describe("Content to write into the file.")
  },
  async ({ filePath, content }) => {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(WORKSPACE_DIR, filePath);
    try {
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, "utf-8");
      return {
        content: [{ type: "text", text: `[✓ Successfully wrote file: ${resolved}]` }]
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: `[Write Error: ${e.message}]` }],
        isError: true
      };
    }
  }
);

// Tool 5: Query DuckDB SQL
server.tool(
  "antigravity_query_duckdb",
  {
    sqlQuery: z.string().describe("SQL query to run over local CSV/Parquet data via DuckDB in Python.")
  },
  async ({ sqlQuery }) => {
    try {
      const result = await new Promise((resolve, reject) => {
        duckDbRequestQueue.push({ resolve, reject });
        const daemon = getDuckDbDaemon();
        const encoded = Buffer.from(sqlQuery).toString("base64");
        daemon.stdin.write(encoded + "\n");
      });
      return {
        content: [{ type: "text", text: result }]
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: `[DuckDB Error: ${e.message}]` }],
        isError: true
      };
    }
  }
);

// Tool 6: Query Google NotebookLM
server.tool(
  "antigravity_query_notebooklm",
  {
    query: z.string().describe("Question to ask Google NotebookLM."),
    notebookId: z.string().default("24fb3456-0d1a-4e3d-864b-952523aa982f").describe("Notebook UUID (defaults to Antigravity RESEARCH SANDBOX).")
  },
  async ({ query, notebookId }) => {
    const result = await runPowerShell(`& "${NLM_EXE}" query "${notebookId}" "${query.replace(/"/g, '`"')}"`);
    return {
      content: [{ type: "text", text: result }]
    };
  }
);

// Tool 7: Dispatch Email via Gemini Spark
server.tool(
  "antigravity_dispatch_email",
  {
    subject: z.string().describe("Subject line of the email."),
    bodyText: z.string().describe("Body content of the email."),
    recipient: z.string().default("huynhbao@asu.edu").describe("Recipient email address.")
  },
  async ({ subject, bodyText, recipient }) => {
    const script = `
import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr

msg = MIMEText("""${bodyText.replace(/"/g, '\\"')}""", "plain", "utf-8")
msg["From"] = formataddr(("Claude & Gemini Spark Copilot", "thuaquan228@gmail.com"))
msg["To"] = formataddr(("Gia Bao Huynh (Jun)", "${recipient}"))
msg["Subject"] = """${subject.replace(/"/g, '\\"')}"""

with smtplib.SMTP("smtp.gmail.com", 587) as server:
    server.starttls()
    server.login("thuaquan228@gmail.com", "tftgqgjmfifdmtzz")
    server.send_message(msg)
print("[✓ Email sent successfully to ${recipient}]")
`;
    const result = await runPowerShell(`& "${PYTHON_EXE}" -c "${script.replace(/"/g, '\\"')}"`);
    return {
      content: [{ type: "text", text: result }]
    };
  }
);

// Start Server with Stdio Transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log strictly to stderr so stdout remains 100% clean JSON-RPC
  console.error("⚡ Antigravity Node MCP Server running on stdio transport");
}

main().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
