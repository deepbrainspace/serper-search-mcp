/**
 * Model Context Protocol server configuration and setup
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { SerperClient } from './infrastructure/api/serperClient.js';
import { SearchService } from './domain/services/searchService.js';
import { SearchToolHandler } from './application/tools/handlers/searchToolHandler.js';
import { searchToolDefinition } from './application/tools/schemas/searchToolSchema.js';

export class SerperSearchServer {
  private server: Server;
  private searchToolHandler: SearchToolHandler;

  constructor() {
    // Initialize server
    this.server = new Server(
      {
        name: 'serper-search-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize domain services and tool handlers
    const serperClient = new SerperClient();
    const searchService = new SearchService(serperClient);
    this.searchToolHandler = new SearchToolHandler(searchService);

    // Register tool handlers
    this.setupToolHandlers();

    // Set up error handling
    this.setupErrorHandling();
  }

  /**
   * Registers tool handlers with the MCP server
   */
  private setupToolHandlers() {
    // Register tool definitions
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [searchToolDefinition],
    }));

    // Register tool request handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== searchToolDefinition.name) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      return this.searchToolHandler.handleSearchRequest(request.params.arguments);
    });
  }

  /**
   * Sets up error handling for the server
   */
  private setupErrorHandling() {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Runs the MCP server
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Serper Search MCP server running on stdio');
  }
}
