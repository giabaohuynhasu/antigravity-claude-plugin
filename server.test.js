import { jest } from '@jest/globals';
import { handlePythonCalc, utils, PYTHON_EXE } from './server.js';

describe('handlePythonCalc', () => {
  let runPowerShellSpy;

  beforeEach(() => {
    runPowerShellSpy = jest.spyOn(utils, 'runPowerShell');
  });

  afterEach(() => {
    runPowerShellSpy.mockRestore();
  });

  it('should call runPowerShell with the correct escaped command for normal input', async () => {
    const mockResult = '2';
    runPowerShellSpy.mockResolvedValue(mockResult);

    const input = { code: 'print(1+1)' };
    const result = await handlePythonCalc(input);

    expect(runPowerShellSpy).toHaveBeenCalledTimes(1);
    expect(runPowerShellSpy).toHaveBeenCalledWith(`& "${PYTHON_EXE}" -c "print(1+1)"`);
    expect(result).toEqual({
      content: [{ type: 'text', text: mockResult }]
    });
  });

  it('should escape double quotes correctly before passing to runPowerShell', async () => {
    const mockResult = 'hello';
    runPowerShellSpy.mockResolvedValue(mockResult);

    const input = { code: 'print("hello")' };
    const result = await handlePythonCalc(input);

    expect(runPowerShellSpy).toHaveBeenCalledTimes(1);
    expect(runPowerShellSpy).toHaveBeenCalledWith(`& "${PYTHON_EXE}" -c "print(\\"hello\\")"`);
    expect(result).toEqual({
      content: [{ type: 'text', text: mockResult }]
    });
  });

  it('should handle error results from runPowerShell correctly', async () => {
    const mockErrorResult = '[Process Error]: spawn powershell.exe ENOENT';
    runPowerShellSpy.mockResolvedValue(mockErrorResult); // runPowerShell resolves errors as text

    const input = { code: 'invalid code' };
    const result = await handlePythonCalc(input);

    expect(runPowerShellSpy).toHaveBeenCalledTimes(1);
    expect(runPowerShellSpy).toHaveBeenCalledWith(`& "${PYTHON_EXE}" -c "invalid code"`);
    expect(result).toEqual({
      content: [{ type: 'text', text: mockErrorResult }]
    });
  });
});
