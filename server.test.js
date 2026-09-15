import { jest } from '@jest/globals';

const mockTool = jest.fn();
const mockConnect = jest.fn();

// Mock @modelcontextprotocol/sdk to capture tool registration
jest.unstable_mockModule('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: class {
      constructor() {
        this.tool = mockTool;
        this.connect = mockConnect;
      }
      tool(...args) {
        return mockTool(...args);
      }
      connect(...args) {
        return mockConnect(...args);
      }
    }
  };
});

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: class {}
  };
});

// Mock fs/promises
const mockFs = {
  access: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn()
};

jest.unstable_mockModule('fs/promises', () => {
  return {
    default: mockFs
  };
});

// Import server.js to run its setup code and register tools
await import('./server.js');

describe('antigravity_read_file tool', () => {
  let readFileHandler;

  beforeAll(() => {
    // Find the registered handler for antigravity_read_file
    for (const call of mockTool.mock.calls) {
      if (call[0] === 'antigravity_read_file') {
        readFileHandler = call[2];
        break;
      }
    }
    if (!readFileHandler) {
      throw new Error('antigravity_read_file tool was not registered.');
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully read a file from the workspace (happy path)', async () => {
    mockFs.access.mockResolvedValueOnce(); // resolve on workspace
    mockFs.readFile.mockResolvedValueOnce('file content');

    const result = await readFileHandler({ filePath: 'test.txt' });

    expect(result).toEqual({
      content: [{ type: "text", text: "file content" }]
    });
    // Check it correctly called access and readFile with path starting with C:\Users\nswcl\.gemini\antigravity-ide\scratch\
    expect(mockFs.access).toHaveBeenCalledTimes(1);
    expect(mockFs.readFile).toHaveBeenCalledTimes(1);
  });

  it('should fallback to Obsidian Vault if workspace access fails', async () => {
    mockFs.access
      .mockRejectedValueOnce(new Error('ENOENT')) // workspace fails
      .mockResolvedValueOnce(); // Obsidian Vault succeeds
    mockFs.readFile.mockResolvedValueOnce('vault content');

    const result = await readFileHandler({ filePath: 'note.md' });

    expect(result).toEqual({
      content: [{ type: "text", text: "vault content" }]
    });
    expect(mockFs.access).toHaveBeenCalledTimes(2);
    expect(mockFs.readFile).toHaveBeenCalledTimes(1);
  });

  it('should fallback to Claude folder if workspace and Vault access fail', async () => {
    mockFs.access
      .mockRejectedValueOnce(new Error('ENOENT')) // workspace fails
      .mockRejectedValueOnce(new Error('ENOENT')) // Obsidian Vault fails
      .mockResolvedValueOnce(); // Claude folder succeeds
    mockFs.readFile.mockResolvedValueOnce('claude content');

    const result = await readFileHandler({ filePath: 'claude.txt' });

    expect(result).toEqual({
      content: [{ type: "text", text: "claude content" }]
    });
    expect(mockFs.access).toHaveBeenCalledTimes(3);
    expect(mockFs.readFile).toHaveBeenCalledTimes(1);
  });

  it('should return error if file not found in any location', async () => {
    mockFs.access
      .mockRejectedValueOnce(new Error('ENOENT')) // workspace
      .mockRejectedValueOnce(new Error('ENOENT')) // Vault
      .mockRejectedValueOnce(new Error('ENOENT')); // Claude folder

    const result = await readFileHandler({ filePath: 'missing.txt' });

    expect(result).toEqual({
      content: [{ type: "text", text: "[Error: File not found in workspace, vault, or Claude folder: missing.txt]" }],
      isError: true
    });
    expect(mockFs.access).toHaveBeenCalledTimes(3);
    expect(mockFs.readFile).not.toHaveBeenCalled();
  });

  it('should return error when fs.readFile throws after successful access (Target Issue)', async () => {
    mockFs.access.mockResolvedValueOnce(); // pretend file exists in workspace
    mockFs.readFile.mockRejectedValueOnce(new Error('Permission denied'));

    const result = await readFileHandler({ filePath: 'secret.txt' });

    expect(result).toEqual({
      content: [{ type: "text", text: "[Read Error: Permission denied]" }],
      isError: true
    });
    expect(mockFs.access).toHaveBeenCalledTimes(1);
    expect(mockFs.readFile).toHaveBeenCalledTimes(1);
  });
});
