import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { version } from 'process';
import type PointerWebSocketServer from './websocket-server';

enum MCPToolName {
  GET_POINTED_ELEMENTS = 'get-pointed-elements',
  GET_POINTED_ELEMENTS_BY_INDEX = 'get-pointed-elements-by-index',
}

enum MCPServerName {
  MCP_POINTER_SERVER = '@mcp-pointer/server',
}

export default class MCPHandler {
  private server: Server;

  private wsServer: PointerWebSocketServer;

  constructor(wsServer: PointerWebSocketServer) {
    this.wsServer = wsServer;
    this.server = new Server(
      {
        name: MCPServerName.MCP_POINTER_SERVER,
        version,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, this.handleListTools.bind(this));
    this.server.setRequestHandler(CallToolRequestSchema, this.handleCallTool.bind(this));
  }

  private async handleListTools() {
    return {
      tools: [
        {
          name: MCPToolName.GET_POINTED_ELEMENTS,
          description: 'Get information about all currently pointed/shown DOM elements from the browser extension. Use this tool when the user says "UIOP" or wants you to analyze specific elements they\'ve selected in their browser, in order to let you see all elements the user is showing you on his/her the browser.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: MCPToolName.GET_POINTED_ELEMENTS_BY_INDEX,
          description: 'Get information about specific pointed/shown DOM elements by their indices from the browser extension. Returns elements at the specified indices, or error messages for non-existent indices.',
          inputSchema: {
            type: 'object',
            properties: {
              indices: {
                type: 'array',
                items: {
                  type: 'number',
                },
                description: 'Array of element indices to retrieve (0-based)',
              },
            },
            required: ['indices'],
          },
        },
      ],
    };
  }

  private async handleCallTool(request: any) {
    if (request.params.name === MCPToolName.GET_POINTED_ELEMENTS) {
      return this.getTargetedElements();
    }

    if (request.params.name === MCPToolName.GET_POINTED_ELEMENTS_BY_INDEX) {
      return this.getTargetedElementsByIndex(request.params.arguments?.indices || []);
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  private getTargetedElements() {
    const elements = this.wsServer.getCurrentElements();

    if (!elements || elements.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No elements are currently pointed. '
              + 'The user needs to point elements in their browser using Option+Click.',
          },
        ],
      };
    }

    let content = `Selected ${elements.length} element(s):\n\n`;
    elements.forEach((element, index) => {
      content += `Element ${index + 1}:\n${JSON.stringify(element, null, 2)}\n\n`;
    });

    return {
      content: [
        {
          type: 'text',
          text: content.trim(),
        },
      ],
    };
  }

  private getTargetedElementsByIndex(indices: number[]) {
    const elements = this.wsServer.getCurrentElements();

    if (!elements || elements.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No elements are currently pointed. '
              + 'The user needs to point elements in their browser using Option+Click.',
          },
        ],
      };
    }

    const results: Array<{ index: number; element?: any; error?: string }> = [];

    indices.forEach((index) => {
      if (index < 0 || index >= elements.length) {
        results.push({
          index,
          error: `Element at index ${index} not found. Available indices: 0-${elements.length - 1}`,
        });
      } else {
        results.push({
          index,
          element: elements[index],
        });
      }
    });

    let content = `Retrieved ${indices.length} element(s) by index:\n\n`;
    results.forEach((result) => {
      if (result.error) {
        content += `Index ${result.index}: ${result.error}\n\n`;
      } else {
        content += `Index ${result.index}:\n${JSON.stringify(result.element, null, 2)}\n\n`;
      }
    });

    return {
      content: [
        {
          type: 'text',
          text: content.trim(),
        },
      ],
    };
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
