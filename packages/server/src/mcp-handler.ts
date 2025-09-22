import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { version } from 'process';
import type PointerWebSocketServer from './websocket-server';

enum MCPToolName {
  GET_POINTED_ELEMENT = 'get-pointed-element',
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
          name: MCPToolName.GET_POINTED_ELEMENT,
          description: 'Get information about the currently pointed/shown DOM elements from the browser extension. Use this tool when the user says "UIOP" or wants you to analyze specific elements they\'ve selected in their browser, in order to let you see a specific element the user is showing you on his/her the browser.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    };
  }

  private async handleCallTool(request: any) {
    if (request.params.name === MCPToolName.GET_POINTED_ELEMENT) {
      return this.getTargetedElement();
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  private getTargetedElement() {
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

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
