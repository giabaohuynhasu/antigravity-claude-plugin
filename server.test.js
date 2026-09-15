import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock child_process
const mockSpawn = jest.fn();
jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn,
  exec: jest.fn()
}));

// Mock @modelcontextprotocol/sdk/server/mcp.js
const mockServerConnect = jest.fn();
const mockServerTool = jest.fn();
jest.unstable_mockModule('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    constructor() {}
    tool = mockServerTool;
    connect = mockServerConnect;
  }
}));

// Mock @modelcontextprotocol/sdk/server/stdio.js
jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class {
    constructor() {}
  }
}));

// Mock fs/promises just in case
jest.unstable_mockModule('fs/promises', () => ({
  default: {
    access: jest.fn(),
    readFile: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn()
  }
}));

const { runPowerShell } = await import('./server.js');

describe('runPowerShell', () => {
  let mockChild;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock child process that behaves like an EventEmitter with stdout/stderr
    mockChild = new EventEmitter();
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();

    mockSpawn.mockReturnValue(mockChild);
  });

  it('should resolve with stdout when process exits with code 0', async () => {
    const promise = runPowerShell('echo "test"');

    // Simulate process execution
    mockChild.stdout.emit('data', Buffer.from('test output\n'));
    mockChild.emit('close', 0);

    const result = await promise;

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockSpawn.mock.calls[0][0]).toBe('powershell.exe');
    expect(result).toBe('test output');
  });

  it('should return a specific message when there is no stdout and exit code is 0', async () => {
    const promise = runPowerShell('echo "test"');

    mockChild.emit('close', 0);

    const result = await promise;
    expect(result).toBe('[Command finished successfully with no stdout]');
  });

  it('should resolve with exit code, stdout, and stderr when process exits with non-zero code', async () => {
    const promise = runPowerShell('invalid_command');

    mockChild.stdout.emit('data', Buffer.from('some output\n'));
    mockChild.stderr.emit('data', Buffer.from('some error\n'));
    mockChild.emit('close', 1);

    const result = await promise;

    expect(result).toBe('[Exit Code 1]\nsome output\nSTDERR:\nsome error');
  });

  it('should resolve with exit code and output (no stderr) when process exits with non-zero code', async () => {
    const promise = runPowerShell('invalid_command');

    mockChild.stdout.emit('data', Buffer.from('some output\n'));
    mockChild.emit('close', 1);

    const result = await promise;

    expect(result).toBe('[Exit Code 1]\nsome output\n');
  });

  it('should resolve with process error message when spawn fails', async () => {
    const promise = runPowerShell('echo "test"');

    mockChild.emit('error', new Error('spawn ENOENT'));

    const result = await promise;

    expect(result).toBe('[Process Error]: spawn ENOENT');
  });
});
