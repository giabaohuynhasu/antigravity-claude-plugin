import { jest } from '@jest/globals';
import EventEmitter from 'events';

// Mocks to capture tool registrations
const mockTool = jest.fn();
const mockConnect = jest.fn();

// We must mock the MCP server and transport to prevent server.js from hanging tests
jest.unstable_mockModule('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: class {
      constructor() {
        this.tool = mockTool;
        this.connect = mockConnect;
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
const mockFsAccess = jest.fn();
const mockFsReadFile = jest.fn();
const mockFsWriteFile = jest.fn();
const mockFsMkdir = jest.fn();

jest.unstable_mockModule('fs/promises', () => {
  return {
    default: {
      access: mockFsAccess,
      readFile: mockFsReadFile,
      writeFile: mockFsWriteFile,
      mkdir: mockFsMkdir,
    }
  };
});

// Mock child_process spawn
const mockSpawn = jest.fn();

jest.unstable_mockModule('child_process', () => {
  return {
    spawn: mockSpawn,
    exec: jest.fn()
  };
});

// Import dynamically after mocking
let serverModule;
beforeAll(async () => {
  serverModule = await import('./server.js');
});

describe('Antigravity MCP Server', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Tool Registration', () => {
    it('should register all expected tools', () => {
      expect(mockTool).toHaveBeenCalledWith(
        'antigravity_python_calc',
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockTool).toHaveBeenCalledWith(
        'antigravity_terminal_exec',
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockTool).toHaveBeenCalledWith(
        'antigravity_read_file',
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockTool).toHaveBeenCalledWith(
        'antigravity_write_file',
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockTool).toHaveBeenCalledWith(
        'antigravity_query_duckdb',
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockTool).toHaveBeenCalledWith(
        'antigravity_query_notebooklm',
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockTool).toHaveBeenCalledWith(
        'antigravity_dispatch_email',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('runPowerShell', () => {
    it('should execute a command and resolve with stdout when code is 0', async () => {
      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockChild);

      const p = serverModule.runPowerShell('echo hello');

      mockChild.stdout.emit('data', Buffer.from('hello output\n'));
      mockChild.emit('close', 0);

      const result = await p;
      expect(result).toBe('hello output');
      expect(mockSpawn).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'echo hello'],
        expect.any(Object)
      );
    });

    it('should execute a command and resolve with fallback when stdout is empty', async () => {
      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockChild);

      const p = serverModule.runPowerShell('do nothing');

      mockChild.emit('close', 0);

      const result = await p;
      expect(result).toBe('[Command finished successfully with no stdout]');
    });

    it('should resolve with stderr when code is not 0', async () => {
      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockChild);

      const p = serverModule.runPowerShell('bad command');

      mockChild.stderr.emit('data', Buffer.from('error text\n'));
      mockChild.emit('close', 1);

      const result = await p;
      expect(result).toBe('[Exit Code 1]\n\nSTDERR:\nerror text');
    });

    it('should resolve with error message on process error', async () => {
      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      mockSpawn.mockReturnValue(mockChild);

      const p = serverModule.runPowerShell('bad command');

      mockChild.emit('error', new Error('spawn failed'));

      const result = await p;
      expect(result).toBe('[Process Error]: spawn failed');
    });
  });
});
