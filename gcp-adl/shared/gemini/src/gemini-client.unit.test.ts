
import { GeminiClient } from './gemini-client';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';

// Mock spawn
jest.mock('child_process', () => ({
    spawn: jest.fn()
}));

// Subclass for testing (to access protected method if needed, or we can just mock spawn globally)
// Since we are mocking child_process.spawn, we don't strictly need to subclass to override spawnChild 
// BUT the current implementation uses `process.execPath` for .js files.
// Let's stick to mocking `spawn` via jest and letting the class call it.

describe('GeminiClient', () => {
    let mockSpawn: jest.Mock;

    beforeEach(() => {
        mockSpawn = spawn as unknown as jest.Mock;
        mockSpawn.mockReset();
    });

    function createMockProcess(exitCode: number, stdout: string, stderr: string = '') {
        const stdoutEmitter = new EventEmitter();
        const stderrEmitter = new EventEmitter();
        const childEmitter = new EventEmitter() as any;
        
        childEmitter.stdout = stdoutEmitter;
        childEmitter.stderr = stderrEmitter;
        childEmitter.stdin = {
            write: jest.fn(),
            end: jest.fn()
        };
        childEmitter.on = jest.fn((event, cb) => {
            if (event === 'close') {
                 // Trigger close asynchronously
                 setTimeout(() => cb(exitCode), 10);
            }
            if (event === 'error') {
                 // handler
            }
        });

        // Trigger data events
        setTimeout(() => {
            if (stdout) stdoutEmitter.emit('data', Buffer.from(stdout));
            if (stderr) stderrEmitter.emit('data', Buffer.from(stderr));
        }, 5);
        
        return childEmitter;
    }

    test('should use local gemini-cli binary', async () => {
         let capturedCmd: string = '';
         let capturedArgs: string[] = [];
         
         mockSpawn.mockImplementation((cmd, args) => {
             capturedCmd = cmd;
             capturedArgs = args;
             return createMockProcess(0, JSON.stringify({ response: 'ok' }));
         });

         const client = new GeminiClient('key');
         await client.generateContent('prompt');
         
         // Verify we are using node to run the script
         expect(capturedCmd).toBe(process.execPath);
         // Verify the first arg is the path to the CLI entry point
         expect(capturedArgs[0]).toContain('node_modules');
         expect(capturedArgs[0]).toMatch(/index\.js$/);
    });

    test('should parse successful JSON response', async () => {
        const mockResponse = {
            response: 'This is the answer',
            stats: { some: 'stat' }
        };
        
        mockSpawn.mockImplementation((cmd, args) => {
             return createMockProcess(0, JSON.stringify(mockResponse));
        });

        const client = new GeminiClient('fake-key');
        const result = await client.generateContent('prompt');
        expect(result).toBe('This is the answer');
    });

    test('should handle Gemini CLI error JSON', async () => {
        const mockError = {
            error: {
                type: 'ApiError',
                message: 'Something went wrong',
                code: 123
            }
        };

        mockSpawn.mockImplementation(() => createMockProcess(1, JSON.stringify(mockError)));
        
        const client = new GeminiClient('fake-key');
        await expect(client.generateContent('prompt'))
            .rejects.toThrow('Something went wrong (ApiError)');
    });

    test('should handle malformed JSON', async () => {
        mockSpawn.mockImplementation(() => createMockProcess(0, 'Not JSON'));
        
        const client = new GeminiClient('fake-key');
        await expect(client.generateContent('prompt'))
            .rejects.toThrow('Failed to parse Gemini CLI JSON output');
    });

    test('should fallback to stderr if exit code non-zero but no JSON error', async () => {
        mockSpawn.mockImplementation(() => createMockProcess(1, 'Some output', 'Fatal error occurred'));
        
        const client = new GeminiClient('fake-key');
        await expect(client.generateContent('prompt'))
            .rejects.toThrow('Stderr: Fatal error occurred');
    });

    test('should use model from constructor options', async () => {
         let capturedArgs: string[] = [];
         mockSpawn.mockImplementation((cmd, args) => {
             capturedArgs = args;
             return createMockProcess(0, JSON.stringify({ response: 'ok' }));
         });

         const client = new GeminiClient('key', { model: 'gemini-pro' });
         await client.generateContent('prompt');
         
         const modelIndex = capturedArgs.indexOf('--model');
         expect(modelIndex).toBeGreaterThan(-1);
         expect(capturedArgs[modelIndex + 1]).toBe('gemini-pro');
    });

    test('should use model from method call options', async () => {
         let capturedArgs: string[] = [];
         mockSpawn.mockImplementation((cmd, args) => {
             capturedArgs = args;
             return createMockProcess(0, JSON.stringify({ response: 'ok' }));
         });

         const client = new GeminiClient('key');
         await client.generateContent('prompt', { model: 'gemini-ultra' });
         
         const modelIndex = capturedArgs.indexOf('--model');
         expect(modelIndex).toBeGreaterThan(-1);
         expect(capturedArgs[modelIndex + 1]).toBe('gemini-ultra');
    });

     test('should fallback on quota error', async () => {
        let attempts = 0;
        mockSpawn.mockImplementation((cmd, args) => {
            attempts++;
            const modelIndex = args.indexOf('--model');
            const model = modelIndex > -1 ? args[modelIndex + 1] : undefined;

            if (attempts === 1) {
                // First attempt
                 expect(model).toBe('primary-model');
                 return createMockProcess(1, JSON.stringify({
                     error: {
                         type: 'QuotaError',
                         message: 'You have exhausted your capacity',
                         code: 429
                     }
                 }));
            } else {
                 // Second attempt
                 expect(model).toBe('gemini-2.5-flash');
                 return createMockProcess(0, JSON.stringify({ response: 'fallback success' }));
            }
        });

        const client = new GeminiClient('key', { model: 'primary-model' });
        const result = await client.generateContent('prompt');
        expect(result).toBe('fallback success');
        expect(attempts).toBe(2);
     });

     test('should NOT fallback on non-quota error', async () => {
        let attempts = 0;
         mockSpawn.mockImplementation(() => {
            attempts++;
            return createMockProcess(1, JSON.stringify({
                error: {
                    message: 'Some other error',
                    code: 500
                }
            }));
        });
        
        const client = new GeminiClient('key');
        await expect(client.generateContent('prompt'))
            .rejects.toThrow('Some other error');
            
        expect(attempts).toBe(1);
     });
});
