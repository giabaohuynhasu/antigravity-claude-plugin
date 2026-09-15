import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Store registered tools
const registeredTools = new Map();

// Mock dependencies
jest.unstable_mockModule('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: class McpServer {
      constructor() {}
      tool(name, schema, handler) {
        registeredTools.set(name, { schema, handler });
      }
      async connect() {
        return Promise.resolve();
      }
    }
  };
});

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: class StdioServerTransport {
      constructor() {}
    }
  };
});

// Mock child_process and fs/promises
const mockSpawn = jest.fn();
jest.unstable_mockModule('child_process', () => ({
  exec: jest.fn(),
  spawn: mockSpawn,
}));

const mockFsAccess = jest.fn();
const mockFsReadFile = jest.fn();
const mockFsMkdir = jest.fn();
const mockFsWriteFile = jest.fn();

jest.unstable_mockModule('fs/promises', () => ({
  default: {
    access: mockFsAccess,
    readFile: mockFsReadFile,
    mkdir: mockFsMkdir,
    writeFile: mockFsWriteFile,
  }
}));

// Import the modules to test (must be dynamic due to unstable_mockModule)
let serverModule;
let runPowerShell;

describe('Antigravity MCP Server Tests', () => {
  beforeAll(async () => {
    // Dynamic import to allow mocks to take effect
    serverModule = await import('./server.js');
    runPowerShell = serverModule.runPowerShell;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runPowerShell', () => {
    it('resolves with stdout when process exits with code 0', async () => {
      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      mockSpawn.mockReturnValueOnce(mockChild);

      const promise = runPowerShell('echo "test"');

      mockChild.stdout.emit('data', Buffer.from('test output\n'));
      mockChild.emit('close', 0);

      const result = await promise;
      expect(result).toBe('test output');
      expect(mockSpawn).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'echo "test"'],
        expect.any(Object)
      );
    });

    it('resolves with default message when stdout is empty and exits with code 0', async () => {
      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      mockSpawn.mockReturnValueOnce(mockChild);

      const promise = runPowerShell('noop');
      mockChild.emit('close', 0);

      const result = await promise;
      expect(result).toBe('[Command finished successfully with no stdout]');
    });

    it('resolves with error message when process exits with non-zero code', async () => {
      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      mockSpawn.mockReturnValueOnce(mockChild);

      const promise = runPowerShell('badcommand');
      mockChild.stdout.emit('data', Buffer.from('some out'));
      mockChild.stderr.emit('data', Buffer.from('some err'));
      mockChild.emit('close', 1);

      const result = await promise;
      expect(result).toContain('[Exit Code 1]');
      expect(result).toContain('some out');
      expect(result).toContain('STDERR:\nsome err');
    });

    it('resolves with process error when child process emits error', async () => {
      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();

      mockSpawn.mockReturnValueOnce(mockChild);

      const promise = runPowerShell('fail');
      mockChild.emit('error', new Error('Spawn failed'));

      const result = await promise;
      expect(result).toBe('[Process Error]: Spawn failed');
    });
  });

  describe('Tools', () => {
    let mockChild;

    beforeEach(() => {
      mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
    });

    it('antigravity_python_calc correctly handles code execution', async () => {
      mockSpawn.mockReturnValueOnce(mockChild);

      const tool = registeredTools.get('antigravity_python_calc');
      expect(tool).toBeDefined();

      const handlerPromise = tool.handler({ code: 'print("hello")' });

      mockChild.stdout.emit('data', Buffer.from('hello\n'));
      mockChild.emit('close', 0);

      const result = await handlerPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'powershell.exe',
        expect.arrayContaining([
          '-Command',
          expect.stringContaining('print(\\"hello\\")') // Verify double quotes escaping
        ]),
        expect.any(Object)
      );

      expect(result.content[0].text).toBe('hello');
    });

    it('antigravity_terminal_exec executes arbitrary command', async () => {
      mockSpawn.mockReturnValueOnce(mockChild);

      const tool = registeredTools.get('antigravity_terminal_exec');
      const handlerPromise = tool.handler({ command: 'dir' });

      mockChild.stdout.emit('data', Buffer.from('directory listing'));
      mockChild.emit('close', 0);

      const result = await handlerPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'powershell.exe',
        expect.arrayContaining(['-Command', 'dir']),
        expect.any(Object)
      );

      expect(result.content[0].text).toBe('directory listing');
    });

    it('antigravity_read_file reads from workspace when file exists', async () => {
      mockFsAccess.mockResolvedValueOnce(); // succeed in workspace
      mockFsReadFile.mockResolvedValueOnce('file content');

      const tool = registeredTools.get('antigravity_read_file');
      const result = await tool.handler({ filePath: 'test.txt' });

      expect(mockFsAccess).toHaveBeenCalledTimes(1);
      expect(mockFsReadFile).toHaveBeenCalledTimes(1);
      expect(result.content[0].text).toBe('file content');
    });

    it('antigravity_read_file falls back and handles missing file', async () => {
      mockFsAccess
        .mockRejectedValueOnce(new Error('not in workspace'))
        .mockRejectedValueOnce(new Error('not in vault'))
        .mockRejectedValueOnce(new Error('not in claude'));

      const tool = registeredTools.get('antigravity_read_file');
      const result = await tool.handler({ filePath: 'test.txt' });

      expect(mockFsAccess).toHaveBeenCalledTimes(3);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: File not found');
    });

    it('antigravity_write_file correctly writes content', async () => {
      mockFsMkdir.mockResolvedValueOnce();
      mockFsWriteFile.mockResolvedValueOnce();

      const tool = registeredTools.get('antigravity_write_file');
      const result = await tool.handler({ filePath: 'new.txt', content: 'new content' });

      expect(mockFsMkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(mockFsWriteFile).toHaveBeenCalledWith(expect.stringContaining('new.txt'), 'new content', 'utf-8');
      expect(result.content[0].text).toContain('Successfully wrote file');
    });

    it('antigravity_query_duckdb executes sql query via python', async () => {
      mockSpawn.mockReturnValueOnce(mockChild);

      const tool = registeredTools.get('antigravity_query_duckdb');
      const handlerPromise = tool.handler({ sqlQuery: 'SELECT * FROM "table"' });

      mockChild.stdout.emit('data', Buffer.from('duckdb result'));
      mockChild.emit('close', 0);

      const result = await handlerPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'powershell.exe',
        expect.arrayContaining([
          '-Command',
          expect.stringContaining('SELECT * FROM')
        ]),
        expect.any(Object)
      );

      expect(result.content[0].text).toBe('duckdb result');
    });

    it('antigravity_query_notebooklm queries notebooklm via executable', async () => {
      mockSpawn.mockReturnValueOnce(mockChild);

      const tool = registeredTools.get('antigravity_query_notebooklm');
      const handlerPromise = tool.handler({ query: 'hello', notebookId: '123' });

      mockChild.stdout.emit('data', Buffer.from('nlm answer'));
      mockChild.emit('close', 0);

      const result = await handlerPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'powershell.exe',
        expect.arrayContaining([
          '-Command',
          expect.stringContaining('nlm.exe" query "123" "hello"')
        ]),
        expect.any(Object)
      );

      expect(result.content[0].text).toBe('nlm answer');
    });

    it('antigravity_dispatch_email sends email via python smtplib', async () => {
      mockSpawn.mockReturnValueOnce(mockChild);

      const tool = registeredTools.get('antigravity_dispatch_email');
      const handlerPromise = tool.handler({
        subject: 'Test Subject',
        bodyText: 'Test Body',
        recipient: 'test@example.com'
      });

      mockChild.stdout.emit('data', Buffer.from('email sent'));
      mockChild.emit('close', 0);

      const result = await handlerPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'powershell.exe',
        expect.arrayContaining([
          '-Command',
          expect.stringContaining('Test Subject')
        ]),
        expect.any(Object)
      );

      expect(result.content[0].text).toBe('email sent');
    });
  });
});

// Provide access to mocks for future steps
export { registeredTools, mockSpawn, mockFsAccess, mockFsReadFile, mockFsMkdir, mockFsWriteFile };
