import { expect } from "chai";
import sinon from "sinon";
import fs from "fs/promises";
import path from "path";
import * as mcp from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

describe("antigravity_read_file tool", () => {
  let toolHandlers = {};
  let originalTool;

  before(async () => {
    // Stub the server connection so we don't start reading from stdin and hanging the test
    sinon.stub(mcp.McpServer.prototype, "connect").resolves();

    // Intercept tool registrations
    originalTool = mcp.McpServer.prototype.tool;
    sinon.stub(mcp.McpServer.prototype, "tool").callsFake(function(name, schema, handler) {
      toolHandlers[name] = handler;
      return originalTool.call(this, name, schema, handler);
    });

    // Import the server module to trigger tool registrations
    await import("../server.js");
  });

  afterEach(() => {
    // Restore specific stubs that might be created inside tests
    if (fs.access.restore) fs.access.restore();
    if (fs.readFile.restore) fs.readFile.restore();
  });

  after(() => {
    sinon.restore();
  });

  it("should return an error when file is not found in any of the 3 fallback directories", async () => {
    // We mock fs.access to reject all calls, simulating the file missing everywhere
    const accessStub = sinon.stub(fs, "access").rejects(new Error("ENOENT"));

    const handler = toolHandlers["antigravity_read_file"];
    const result = await handler({ filePath: "missing-file.txt" });

    // Verify fs.access was called sequentially 3 times
    expect(accessStub.callCount).to.equal(3);

    // Verify the response is correctly formatted as an error
    expect(result).to.deep.equal({
      content: [{ type: "text", text: `[Error: File not found in workspace, vault, or Claude folder: missing-file.txt]` }],
      isError: true
    });
  });

  it("should return file content if found in workspace", async () => {
    const accessStub = sinon.stub(fs, "access").resolves();
    const readFileStub = sinon.stub(fs, "readFile").resolves("workspace content");

    const handler = toolHandlers["antigravity_read_file"];
    const result = await handler({ filePath: "found.txt" });

    expect(accessStub.callCount).to.equal(1);
    expect(result).to.deep.equal({
      content: [{ type: "text", text: "workspace content" }]
    });
  });

  it("should return file content if found in vault but not workspace", async () => {
    const accessStub = sinon.stub(fs, "access");
    accessStub.onCall(0).rejects(new Error("ENOENT")); // workspace
    accessStub.onCall(1).resolves(); // vault

    const readFileStub = sinon.stub(fs, "readFile").resolves("vault content");

    const handler = toolHandlers["antigravity_read_file"];
    const result = await handler({ filePath: "vault.txt" });

    expect(accessStub.callCount).to.equal(2);
    expect(result).to.deep.equal({
      content: [{ type: "text", text: "vault content" }]
    });
  });

  it("should return file content if found in Claude folder but not workspace or vault", async () => {
    const accessStub = sinon.stub(fs, "access");
    accessStub.onCall(0).rejects(new Error("ENOENT")); // workspace
    accessStub.onCall(1).rejects(new Error("ENOENT")); // vault
    accessStub.onCall(2).resolves(); // claude folder

    const readFileStub = sinon.stub(fs, "readFile").resolves("claude content");

    const handler = toolHandlers["antigravity_read_file"];
    const result = await handler({ filePath: "claude.txt" });

    expect(accessStub.callCount).to.equal(3);
    expect(result).to.deep.equal({
      content: [{ type: "text", text: "claude content" }]
    });
  });
});
