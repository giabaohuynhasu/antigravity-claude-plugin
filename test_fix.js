import path from "path";

const WORKSPACE_DIR = "C:\\Users\\nswcl\\.gemini\\antigravity-ide\\scratch";
const VAULT_DIR = "C:\\Users\\nswcl\\OneDrive\\Documents\\Obsidian Vault";
const CLAUDE_USER_DIR = "C:\\Users\\nswcl\\Claude";

function isPathAllowed(resolvedPath) {
  const allowedDirs = [WORKSPACE_DIR, VAULT_DIR, CLAUDE_USER_DIR];
  return allowedDirs.some((dir) => {
    // If we're evaluating Windows paths on a Linux environment, path.relative will treat it as a single string
    // unless we use path.win32. We should use path.win32 to correctly handle Windows paths.
    const rel = path.win32.relative(dir, resolvedPath);
    return rel === "" || (!rel.startsWith("..") && !path.win32.isAbsolute(rel));
  });
}

const tests = [
  { path: "test.txt", expected: true },
  { path: "../../../Windows/System32/config/SAM", expected: false },
  { path: "C:\\Windows\\System32\\cmd.exe", expected: false },
  { path: "C:\\Users\\nswcl\\.gemini\\antigravity-ide\\scratch\\allowed.txt", expected: true },
  { path: "C:\\Users\\nswcl\\OneDrive\\Documents\\Obsidian Vault\\my-note.md", expected: true },
  { path: "C:\\Users\\nswcl\\Claude\\chat.json", expected: true },
  { path: "C:\\Users\\nswcl\\Claude\\..\\Downloads\\malware.exe", expected: false }
];

let allPassed = true;
for (const t of tests) {
  // Use path.win32 to resolve
  const resolved = path.win32.resolve(path.win32.isAbsolute(t.path) ? t.path : path.win32.join(WORKSPACE_DIR, t.path));
  const result = isPathAllowed(resolved);
  if (result !== t.expected) {
    console.error(`FAIL: ${t.path} -> Expected ${t.expected}, got ${result}`);
    allPassed = false;
  } else {
    console.log(`PASS: ${t.path}`);
  }
}

if (!allPassed) {
  process.exit(1);
}
console.log("All tests passed!");
