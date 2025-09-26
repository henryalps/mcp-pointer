import fs from 'fs/promises';
import SharedStateService from '../../services/shared-state-service';
import {
  setupTestDir, cleanupTestFiles, createMockElement, TEST_SHARED_STATE_PATH,
} from '../test-helpers';

describe('SharedStateService', () => {
  let service: SharedStateService;

  beforeAll(async () => {
    await setupTestDir();

    // Monkey-patch the constant for testing
    const SharedStateServiceModule = await import('../../services/shared-state-service');
    const SharedStateServiceClass = SharedStateServiceModule.default;

    // Override the static constant
    (SharedStateServiceClass as any).SHARED_STATE_PATH = TEST_SHARED_STATE_PATH;

    service = new SharedStateServiceClass();
  });

  afterAll(async () => {
    await cleanupTestFiles();
  });

  it('should save and load current element', async () => {
    const mockElement = createMockElement();

    await service.saveCurrentElements([mockElement]);
    const loadedElements = await service.getCurrentElements();

    expect(loadedElements).toBeTruthy();
    expect(loadedElements).toHaveLength(1);
    const [loadedElement] = loadedElements!;
    expect(loadedElement.idx).toBe(mockElement.idx);
    expect(loadedElement.selector).toBe(mockElement.selector);
    expect(loadedElement.tagName).toBe(mockElement.tagName);
    expect(loadedElement.id).toBe(mockElement.id);
    expect(loadedElement.classes).toEqual(mockElement.classes);
    expect(loadedElement.innerText).toBe(mockElement.innerText);
    expect(loadedElement.position).toEqual(mockElement.position);
    expect(loadedElement.allCss).toEqual(mockElement.allCss);
    expect(loadedElement.url).toBe(mockElement.url);
    expect(loadedElement.tabId).toBe(mockElement.tabId);
  });

  it('should handle null element', async () => {
    await service.saveCurrentElements(null);
    const loadedElements = await service.getCurrentElements();

    expect(loadedElements).toBeNull();
  });

  it('should return null for missing file', async () => {
    // Delete the file if it exists
    try {
      await fs.unlink(TEST_SHARED_STATE_PATH);
    } catch {
      // File doesn't exist, which is fine
    }

    const loadedElements = await service.getCurrentElements();
    expect(loadedElements).toBeNull();
  });

  it('should handle corrupted file gracefully', async () => {
    // Write invalid JSON to the file
    await fs.writeFile(TEST_SHARED_STATE_PATH, 'invalid json content');

    const loadedElements = await service.getCurrentElements();
    expect(loadedElements).toBeNull();
  });

  it('should save element over corrupted file', async () => {
    // Write invalid JSON to the file
    await fs.writeFile(TEST_SHARED_STATE_PATH, 'invalid json content');

    const mockElement = createMockElement();
    await service.saveCurrentElements([mockElement]);

    const loadedElements = await service.getCurrentElements();
    expect(loadedElements).toBeTruthy();
    expect(loadedElements).toHaveLength(1);
    expect(loadedElements![0].selector).toBe(mockElement.selector);
    expect(loadedElements![0].idx).toBe(mockElement.idx);
  });

  it('should overwrite previous element', async () => {
    const firstElement = createMockElement();
    firstElement.selector = 'div.first-element';

    const secondElement = createMockElement();
    secondElement.selector = 'div.second-element';

    await service.saveCurrentElements([firstElement]);
    await service.saveCurrentElements([secondElement]);

    const loadedElements = await service.getCurrentElements();
    expect(loadedElements).toBeTruthy();
    expect(loadedElements).toHaveLength(1);
    expect(loadedElements![0].selector).toBe('div.second-element');
  });
});
