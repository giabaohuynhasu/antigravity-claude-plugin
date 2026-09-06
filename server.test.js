import { expect } from 'chai';
import sinon from 'sinon';
import child_process from 'child_process';
import { runPowerShell } from './server.js';
import { EventEmitter } from 'events';

describe('runPowerShell', function() {
  let spawnStub;

  beforeEach(() => {
    spawnStub = sinon.stub(child_process, 'spawn');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('resolves with stdout on exit code 0', async function() {
    const mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    spawnStub.returns(mockProcess);

    const promise = runPowerShell('echo test');

    mockProcess.stdout.emit('data', Buffer.from('test output\n'));
    mockProcess.emit('close', 0);

    const result = await promise;
    expect(result).to.equal('test output');
  });

  it('resolves with fallback message on exit code 0 if stdout is empty', async function() {
    const mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    spawnStub.returns(mockProcess);

    const promise = runPowerShell('echo test');

    mockProcess.emit('close', 0);

    const result = await promise;
    expect(result).to.equal('[Command finished successfully with no stdout]');
  });

  it('resolves with stderr on non-zero exit code', async function() {
    const mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    spawnStub.returns(mockProcess);

    const promise = runPowerShell('invalid_command');

    mockProcess.stdout.emit('data', Buffer.from('stdout output\n'));
    mockProcess.stderr.emit('data', Buffer.from('stderr output\n'));
    mockProcess.emit('close', 1);

    const result = await promise;
    expect(result).to.equal('[Exit Code 1]\nstdout output\nSTDERR:\nstderr output');
  });

  it('resolves with process error message on error event', async function() {
    const mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    spawnStub.returns(mockProcess);

    const promise = runPowerShell('some_command');

    mockProcess.emit('error', new Error('spawn powershell.exe ENOENT'));

    const result = await promise;
    expect(result).to.equal('[Process Error]: spawn powershell.exe ENOENT');
  });
});
