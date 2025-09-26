import type { TargetedElement } from '@mcp-pointer/shared/types';
import defaultConfig, { ExtensionConfig } from '../utils/config';
import logger from '../utils/logger';
import ConfigStorageService from './config-storage-service';

export default class PopupManagerService {
  private enabledInput: HTMLInputElement;

  private portInput: HTMLInputElement;

  private saveBtn: HTMLButtonElement;

  private resetBtn: HTMLButtonElement;

  private status: HTMLElement;

  private selectionList: HTMLUListElement;

  private selectionEmpty: HTMLElement;

  private refreshSelectionsBtn: HTMLButtonElement;

  private unselectBtn: HTMLButtonElement;

  private toggleAllInput: HTMLInputElement;

  constructor() {
    this.enabledInput = document.getElementById('enabled') as HTMLInputElement;
    this.portInput = document.getElementById('port') as HTMLInputElement;
    this.saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    this.resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
    this.status = document.getElementById('status') as HTMLElement;
    this.selectionList = document.getElementById('selectionList') as HTMLUListElement;
    this.selectionEmpty = document.getElementById('selectionEmpty') as HTMLElement;
    this.refreshSelectionsBtn = document.getElementById('refreshSelectionsBtn') as HTMLButtonElement;
    this.unselectBtn = document.getElementById('unselectBtn') as HTMLButtonElement;
    this.toggleAllInput = document.getElementById('toggleAllSelections') as HTMLInputElement;

    this.setupEventListeners();
    this.loadConfig();
    this.refreshSelections();
  }

  private setupEventListeners(): void {
    this.saveBtn.addEventListener('click', () => this.saveConfig());
    this.resetBtn.addEventListener('click', () => this.resetToDefaults());
    this.refreshSelectionsBtn.addEventListener('click', () => this.refreshSelections());
    this.unselectBtn.addEventListener('click', () => this.handleUnselect());
    this.toggleAllInput.addEventListener('change', () => this.handleToggleAll());
  }

  private async loadConfig(): Promise<void> {
    try {
      const config = await ConfigStorageService.load();

      this.enabledInput.checked = config.enabled;
      this.portInput.value = config.websocket.port.toString();
    } catch (error) {
      this.showStatus('Failed to load configuration', 'error');
      logger.error('Error loading config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const port = parseInt(this.portInput.value, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        this.showStatus('Port must be a number between 1 and 65535', 'error');
        return;
      }

      const config: ExtensionConfig = {
        enabled: this.enabledInput.checked,
        websocket: {
          port,
        },
        logger: {
          enabled: defaultConfig.logger.enabled,
          level: defaultConfig.logger.level,
        },
      };

      await ConfigStorageService.save(config);
      this.showStatus('Settings saved successfully', 'success');
    } catch (error) {
      this.showStatus('Failed to save configuration', 'error');
      logger.error('Error saving config:', error);
    }
  }

  private async resetToDefaults(): Promise<void> {
    try {
      await ConfigStorageService.save(defaultConfig);
      await this.loadConfig();
      this.showStatus('Settings reset to defaults', 'success');
    } catch (error) {
      this.showStatus('Failed to reset configuration', 'error');
      logger.error('Error resetting config:', error);
    }
  }

  private async refreshSelections(): Promise<void> {
    try {
      const response = await this.sendRuntimeMessage<{ success: boolean; elements?: TargetedElement[]; error?: string }>(
        { type: 'GET_SELECTED_ELEMENTS' },
      );

      if (!response?.success) {
        throw new Error(response?.error || '获取已选元素失败');
      }

      this.renderSelections(response.elements ?? []);
    } catch (error) {
      this.renderSelections([]);
      this.showStatus('无法读取已选元素', 'error');
      logger.error('Error fetching selections:', error);
    }
  }

  private renderSelections(elements: TargetedElement[]): void {
    this.selectionList.innerHTML = '';

    if (!elements || elements.length === 0) {
      this.selectionEmpty.style.display = 'block';
      this.unselectBtn.disabled = true;
      return;
    }

    this.selectionEmpty.style.display = 'none';

    elements.forEach((element) => {
      const item = document.createElement('li');
      item.className = 'selection-item';

      const label = document.createElement('label');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = element.timestamp.toString();
      checkbox.addEventListener('change', () => this.updateUnselectButtonState());

      const content = document.createElement('div');
      content.className = 'selection-item__content';

      const primary = document.createElement('span');
      primary.className = 'selection-item__primary';
      primary.textContent = `#${element.idx} ${element.selector}`;

      const innerText = (element.innerText || '').replace(/\s+/g, ' ').trim();
      if (innerText) {
        const secondaryText = document.createElement('span');
        secondaryText.className = 'selection-item__secondary';
        secondaryText.textContent = innerText.length > 80
          ? `${innerText.slice(0, 77)}...`
          : innerText;
        content.appendChild(secondaryText);
      }

      const secondaryUrl = document.createElement('span');
      secondaryUrl.className = 'selection-item__secondary';
      secondaryUrl.textContent = element.url;

      content.prepend(primary);
      content.appendChild(secondaryUrl);

      label.append(checkbox, content);
      item.appendChild(label);
      this.selectionList.appendChild(item);
    });

    this.updateUnselectButtonState();
    this.toggleAllInput.checked = false;
  }

  private updateUnselectButtonState(): void {
    const hasChecked = this.selectionList
      .querySelector('input[type="checkbox"]:checked') !== null;
    this.unselectBtn.disabled = !hasChecked;
  }

  private handleToggleAll(): void {
    const shouldSelectAll = this.toggleAllInput.checked;
    const checkboxes = this.selectionList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

    checkboxes.forEach((checkbox) => {
      checkbox.checked = shouldSelectAll;
    });

    this.updateUnselectButtonState();
  }

  private async handleUnselect(): Promise<void> {
    const checkedInputs = Array.from(
      this.selectionList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'),
    );

    if (checkedInputs.length === 0) {
      return;
    }

    const timestamps = checkedInputs
      .map((input) => Number.parseInt(input.value, 10))
      .filter((value) => !Number.isNaN(value));

    try {
      const response = await this.sendRuntimeMessage<{ success: boolean; error?: string }>(
        {
          type: 'REMOVE_SELECTED_ELEMENTS',
          timestamps,
        },
      );

      if (!response?.success) {
        throw new Error(response?.error || '取消选中失败');
      }

      this.showStatus('已取消选中元素', 'success');
      await this.refreshSelections();
    } catch (error) {
      this.showStatus('取消选中失败', 'error');
      logger.error('Error removing selections:', error);
    }
  }

  private sendRuntimeMessage<T>(message: any): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response: any) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve(response as T);
      });
    });
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    this.status.textContent = message;
    this.status.className = `status ${type} visible`;

    setTimeout(() => {
      this.status.classList.remove('visible');
    }, 3000);
  }
}
