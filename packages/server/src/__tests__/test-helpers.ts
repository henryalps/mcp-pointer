import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { TargetedElement } from '@mcp-pointer/shared/types';

// Test constants - use a temp directory that works in Jest
export const TEST_MCP_POINTER_PORT = 7008;
export const TEST_TEMP_DIR = path.join(os.tmpdir(), 'mcp-pointer-test');
export const TEST_SHARED_STATE_PATH = path.join(TEST_TEMP_DIR, 'mcp-pointer-test-shared-state.json');

export async function setupTestDir(): Promise<void> {
  try {
    await fs.mkdir(TEST_TEMP_DIR, { recursive: true });
  } catch {
    // Directory exists, ignore
  }
}

export async function cleanupTestFiles(): Promise<void> {
  try {
    await fs.rm(TEST_TEMP_DIR, { recursive: true, force: true });
  } catch {
    // Directory doesn't exist, ignore
  }
}

export function createMockElement(): TargetedElement {
  return {
    idx: 1,
    selector: 'div.test-element',
    tagName: 'DIV',
    id: 'test-id',
    classes: ['test-class'],
    innerText: 'Test Element',
    outerHTML: '<div id="test-id" class="test-class">Test Element</div>',
    attributes: { 'data-test': 'true' },
    position: {
      x: 100, y: 200, width: 300, height: 50,
    },
    cssProperties: {
      display: 'block',
      position: 'relative',
      fontSize: '16px',
      color: 'rgb(0, 0, 0)',
      backgroundColor: 'rgb(255, 255, 255)',
    },
    timestamp: Date.now(),
    url: 'https://example.com',
    tabId: 123,
  };
}
