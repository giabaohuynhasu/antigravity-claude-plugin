import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mocked tools and functions
const mockTool = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(undefined);

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: vi.fn().mockImplementation(function (config) {
      this.tool = mockTool;
      this.connect = mockConnect;
    })
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: vi.fn()
  };
});

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn()
}));

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn()
  }
}));

describe('server.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize McpServer and register tools correctly', async () => {
    // dynamically import server.js so mocks are applied
    await import('./server.js');

    // Check if McpServer was initialized with correct config
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    expect(McpServer).toHaveBeenCalledWith({
      name: 'antigravity-copilot',
      version: '1.0.0'
    });

    // Check if tools were registered
    expect(mockTool).toHaveBeenCalled();
    const calls = mockTool.mock.calls;

    const toolNames = calls.map(call => call[0]);
    expect(toolNames).toContain('antigravity_python_calc');
    expect(toolNames).toContain('antigravity_terminal_exec');
    expect(toolNames).toContain('antigravity_read_file');
    expect(toolNames).toContain('antigravity_write_file');
    expect(toolNames).toContain('antigravity_query_duckdb');
    expect(toolNames).toContain('antigravity_query_notebooklm');
    expect(toolNames).toContain('antigravity_dispatch_email');

    // Check if connect was called
    expect(mockConnect).toHaveBeenCalled();
  });
});
