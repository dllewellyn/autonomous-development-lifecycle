import { GeminiClient } from './gemini-client';

/**
 * Standalone test for GeminiClient
 * Assumes:
 * - gemini CLI is installed and available in PATH
 * - GEMINI_API_KEY environment variable is set
 * 
 * Run with: npx ts-node src/gemini-client.test.ts
 */

async function testBasicPrompt() {
  console.log('Testing basic prompt...');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const client = new GeminiClient(apiKey);
  
  try {
    const response = await client.generateContent('What is 2+2? Answer with just the number.');
    console.log('✓ Basic prompt succeeded');
    console.log(`  Response: ${response.substring(0, 100)}...`);
    return true;
  } catch (error) {
    console.error('✗ Basic prompt failed:', error);
    return false;
  }
}

async function testLongPrompt() {
  console.log('\nTesting long prompt with context...');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const client = new GeminiClient(apiKey);
  
  const longPrompt = `
You are analyzing a TypeScript file.

### File: example.ts
\`\`\`typescript
function add(a: number, b: number): number {
  return a + b;
}

function multiply(a: number, b: number): number {
  return a * b;
}
\`\`\`

Question: How many functions are defined in this file? Answer with just the number.
`;

  try {
    const response = await client.generateContent(longPrompt);
    console.log('✓ Long prompt succeeded');
    console.log(`  Response: ${response.substring(0, 100)}...`);
    return true;
  } catch (error) {
    console.error('✗ Long prompt failed:', error);
    return false;
  }
}

async function testGenerateWithContext() {
  console.log('\nTesting generateWithContext...');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const client = new GeminiClient(apiKey);
  
  const files = [
    {
      path: 'src/utils.ts',
      content: 'export function formatDate(date: Date): string { return date.toISOString(); }'
    },
    {
      path: 'src/main.ts',
      content: 'import { formatDate } from "./utils"; console.log(formatDate(new Date()));'
    }
  ];

  try {
    const response = await client.generateWithContext(
      'How many files are provided? Answer with just the number.',
      files
    );
    console.log('✓ generateWithContext succeeded');
    console.log(`  Response: ${response.substring(0, 100)}...`);
    return true;
  } catch (error) {
    console.error('✗ generateWithContext failed:', error);
    return false;
  }
}

async function main() {
  console.log('=== GeminiClient Standalone Tests ===\n');
  
  const results = await Promise.all([
    testBasicPrompt(),
    testLongPrompt(),
    testGenerateWithContext()
  ]);

  const allPassed = results.every(r => r);
  
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${results.filter(r => r).length}/${results.length}`);
  
  if (allPassed) {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests failed');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
