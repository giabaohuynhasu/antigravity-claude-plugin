import { vi, describe, it, expect, beforeAll, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";

const registeredTools = {};

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  return {
    McpServer: class {
      constructor() {}
      tool(name, schema, handler) {
        registeredTools[name] = handler;
      }
      async connect() {}
    }
  };
});

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => {
  return {
    StdioServerTransport: class {}
  };
});

vi.mock("fs/promises");

describe("antigravity_write_file", () => {
  beforeAll(async () => {
    // Import server.js to register tools
    await import("./server.js");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should successfully write file with absolute path", async () => {
    const handler = registeredTools["antigravity_write_file"];
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);

    const result = await handler({ filePath: "/absolute/path/test.txt", content: "test" });
    expect(result).toEqual({
      content: [{ type: "text", text: `[✓ Successfully wrote file: /absolute/path/test.txt]` }]
    });
  });

  it("should handle write error from fs.mkdir", async () => {
    const handler = registeredTools["antigravity_write_file"];
    fs.mkdir.mockRejectedValue(new Error("Permission denied during mkdir"));

    const result = await handler({ filePath: "test.txt", content: "test" });
    expect(result).toEqual({
      content: [{ type: "text", text: "[Write Error: Permission denied during mkdir]" }],
      isError: true
    });
  });

  it("should handle write error from fs.writeFile", async () => {
    const handler = registeredTools["antigravity_write_file"];
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockRejectedValue(new Error("Permission denied during writeFile"));

    const result = await handler({ filePath: "test.txt", content: "test" });
    expect(result).toEqual({
      content: [{ type: "text", text: "[Write Error: Permission denied during writeFile]" }],
      isError: true
    });
  });
});
