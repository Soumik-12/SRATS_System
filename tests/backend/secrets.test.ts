import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Security & Secrets Hygiene Suite', () => {
  test('1. No real secrets in .env.example', () => {
    const envExamplePath = path.resolve(__dirname, '../../.env.example');
    assert.strictEqual(fs.existsSync(envExamplePath), true);
    const content = fs.readFileSync(envExamplePath, 'utf-8');
    assert.ok(content.includes('MY_GEMINI_API_KEY'));
    assert.strictEqual(content.includes('AIzaSy'), false, 'Cannot contain real Google API key');
  });

  test('2. Client source directory does not import @google/genai directly', () => {
    const srcDir = path.resolve(__dirname, '../../src');
    const readDirRecursive = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(readDirRecursive(fullPath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(fullPath);
        }
      });
      return results;
    };

    const files = readDirRecursive(srcDir);
    for (const file of files) {
      const code = fs.readFileSync(file, 'utf-8');
      assert.strictEqual(
        code.includes('@google/genai'),
        false,
        `File ${file} imports @google/genai in client code! Gemini must remain strictly server-side.`
      );
      assert.strictEqual(
        code.includes('process.env.GEMINI_API_KEY'),
        false,
        `File ${file} references GEMINI_API_KEY in client code!`
      );
    }
  });
});
