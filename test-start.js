import { spawn } from "child_process";

const child = spawn("node", ["server.js"], { stdio: 'pipe' });

let output = '';
child.stderr.on("data", (data) => {
    output += data.toString();
    if (output.includes("⚡ Antigravity Node MCP Server running on stdio transport")) {
        console.log("Server started successfully!");
        child.kill();
        process.exit(0);
    }
});

child.stdout.on("data", (data) => {
    output += data.toString();
});

child.on("close", (code) => {
    if (code !== 0 && code !== null) {
        console.error("Server exited with code:", code);
        console.error("Output:", output);
        process.exit(1);
    }
});

setTimeout(() => {
    console.error("Timeout waiting for server to start");
    child.kill();
    process.exit(1);
}, 5000);
