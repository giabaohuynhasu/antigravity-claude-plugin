import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import * as child_process from 'child_process';

const originalSpawn = child_process.spawn;

jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn()
}));

const { runPowerShell } = await import('./server.js');

describe('runPowerShell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('resolves with stdout when process exits with code 0', async () => {
    const { spawn } = await import('child_process');

    const mockChild = new EventEmitter();
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();

    spawn.mockReturnValueOnce(mockChild);

    const promise = runPowerShell('echo "test"');

    mockChild.stdout.emit('data', Buffer.from('test output\n'));
    mockChild.emit('close', 0);

    const result = await promise;
    expect(result).toBe('test output');

    expect(spawn).toHaveBeenCalledWith(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'echo "test"'],
      expect.any(Object)
    );
  });

  test('resolves with default message when process exits with code 0 and no output', async () => {
    const { spawn } = await import('child_process');

    const mockChild = new EventEmitter();
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();

    spawn.mockReturnValueOnce(mockChild);

    const promise = runPowerShell('echo ""');

    mockChild.emit('close', 0);

    const result = await promise;
    expect(result).toBe('[Command finished successfully with no stdout]');
  });

  test('resolves with error message when process exits with non-zero code', async () => {
    const { spawn } = await import('child_process');

    const mockChild = new EventEmitter();
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();

    spawn.mockReturnValueOnce(mockChild);

    const promise = runPowerShell('invalid_command');

    mockChild.stdout.emit('data', Buffer.from('partial out'));
    mockChild.stderr.emit('data', Buffer.from('some error'));
    mockChild.emit('close', 1);

    const result = await promise;
    expect(result).toBe('[Exit Code 1]\npartial out\nSTDERR:\nsome error');
  });

  test('resolves with error message on process error', async () => {
    const { spawn } = await import('child_process');

    const mockChild = new EventEmitter();
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();

    spawn.mockReturnValueOnce(mockChild);

    const promise = runPowerShell('invalid_command');

    mockChild.emit('error', new Error('spawn ENOENT'));

    const result = await promise;
    expect(result).toBe('[Process Error]: spawn ENOENT');
  });
});
