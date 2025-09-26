import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { version } from 'process';
import SharedStateService from './shared-state-service';

enum MCPToolName {
  GET_POINTED_ELEMENT = 'get-pointed-element',
}

enum MCPServerName {
  MCP_POINTER = 'mcp-pointer',
}

export default class MCPService {
  private server: Server;

  private sharedState: SharedStateService;

  constructor(sharedState: SharedStateService) {
    this.sharedState = sharedState;
    this.server = new Server(
      {
        name: MCPServerName.MCP_POINTER,
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

  private async getTargetedElement() {
    const elements = await this.sharedState.getCurrentElements();

    if (!elements || elements.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No element is currently pointed. '
              + 'The user needs to point an element in their browser using Option+Click.',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(elements, null, 2),
        },
      ],
    };
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
