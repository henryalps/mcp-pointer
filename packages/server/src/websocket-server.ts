import { WebSocketServer } from 'ws';
import { PointerMessage, PointerMessageType, TargetedElement } from '@mcp-pointer/shared/types';
import { config } from './config';
import logger from './logger';

export default class PointerWebSocketServer {
  private wss: WebSocketServer | null = null;

  private currentElements: TargetedElement[] | null = null;

  private port: number;

  constructor(port: number = config.websocket.port) {
    this.port = port;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port });

      this.wss.on('connection', (ws) => {
        logger.info('👆 Browser extension connected to WebSocket server');

        ws.on('message', (data) => {
          try {
            const message: PointerMessage = JSON.parse(data.toString());
            logger.info('📨 Received message from browser:', message.type);
            this.handleMessage(message);
          } catch (error) {
            logger.error('Failed to parse message:', error);
          }
        });

        ws.on('close', () => {
          logger.info('👆 Browser extension disconnected from WebSocket server');
        });
      });

      this.wss.on('listening', () => {
        logger.info(`WebSocket server listening on port ${this.port}`);
        resolve();
      });

      this.wss.on('error', reject);
    });
  }

  private handleMessage(message: PointerMessage): void {
    if (message.type === PointerMessageType.ELEMENT_SELECTED && message.data) {
      this.currentElements = Array.isArray(message.data)
        ? (message.data as TargetedElement[])
        : [message.data as TargetedElement];
    } else if (message.type === PointerMessageType.ELEMENT_CLEARED) {
      this.currentElements = null;
    }
  }

  public getCurrentElements(): TargetedElement[] | null {
    return this.currentElements;
  }

  public stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}
