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
  CallToolRequest,
  // ToolDefinition, // Removed as it might not be exported directly
} from '@modelcontextprotocol/sdk/types.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to read and parse package.json
const readPackageJson = () => {
  // For ESM, __dirname is not available directly. Construct path from import.meta.url.
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDirPath = path.dirname(currentFilePath);
  const packageJsonPath = path.resolve(currentDirPath, '../package.json');
  const fileContent = fs.readFileSync(packageJsonPath, 'utf-8');
  return JSON.parse(fileContent);
};
const packageInfo = readPackageJson();

import { SerperClient } from './infrastructure/api/serperClient.js';
import { OpenRouterClient } from './infrastructure/api/openRouterClient.js';
import { GoogleGenAIClient } from './infrastructure/api/googleGenAiClient.js';
import { LLMAdapter } from './adapters/llm/llmAdapter.js';
import { OpenRouterAdapter } from './adapters/llm/openRouterAdapter.js';
import { GoogleGenAIAdapter } from './adapters/llm/googleGenAiAdapter.js';
import { config } from './infrastructure/config/environment.js';
import { SearchService } from './domain/services/searchService.js';
import { AgentService } from './domain/services/agentService.js';
import { ResearchService } from './domain/services/researchService.js';
import { SearchToolHandler } from './application/tools/handlers/searchToolHandler.js';
import { ResearchToolHandler } from './application/tools/handlers/researchToolHandler.js';
import { searchToolDefinition } from './application/tools/schemas/searchToolSchema.js';
import { researchToolDefinition } from './application/tools/schemas/researchToolSchema.js';
import { ResearchOrchestrator } from './application/orchestration/researchOrchestrator.js';
import { MetricsService } from './infrastructure/quality/metricsService.js';

export class SerperSearchServer {
  private server: Server;
  private searchToolHandler: SearchToolHandler;
  private researchToolHandler: ResearchToolHandler;

  constructor() {
    // Initialize server
    this.server = new Server(
      {
        name: packageInfo.name, // Use name from package.json
        version: packageInfo.version, // Use version from package.json
      },
      {
        capabilities: {
          tools: {}, // Tools will be dynamically added based on LLM config
        },
      }
    );

    // Initialize API clients
    const serperClient = new SerperClient();
    
    // Initialize LLM Client and Adapter based on configuration
    let llmAdapter: LLMAdapter | null = null;
    if (config.llmProvider === 'google' && config.llmApiKey) {
      try {
        const googleClient = new GoogleGenAIClient(config.llmApiKey, config.llmModel);
        llmAdapter = new GoogleGenAIAdapter(googleClient);
        console.log(`Using Google GenAI LLM provider with model: ${config.llmModel}`);
      } catch (error) {
        console.error('Failed to initialize GoogleGenAIClient:', error);
      }
    } else if (config.llmProvider === 'openrouter' && config.llmApiKey) {
      try {
        const openRouterClient = new OpenRouterClient(config.llmApiKey, config.llmModel);
        llmAdapter = new OpenRouterAdapter(openRouterClient);
        console.log(`Using OpenRouter LLM provider with model: ${config.llmModel}`);
      } catch (error) {
        console.error('Failed to initialize OpenRouterClient:', error);
      }
    }

    if (!llmAdapter) {
      console.warn('No LLM provider configured or API key missing. Deep research tool will be unavailable.');
    }
    
    // Initialize services
    const searchService = new SearchService(serperClient);
    const agentService = new AgentService(); // No constructor parameters needed
    const researchService = new ResearchService(); // No constructor parameters needed
    const metricsService = new MetricsService();
    
    // Initialize orchestrators
    // Initialize orchestrators - only if llmAdapter is available
    let researchOrchestrator: ResearchOrchestrator | null = null;
    if (llmAdapter) {
      researchOrchestrator = new ResearchOrchestrator(
        researchService,
        agentService,
        searchService,
        llmAdapter, // llmAdapter is now potentially null, ResearchOrchestrator needs to handle this
        metricsService
      );
    }
    
    // Initialize tool handlers
    this.searchToolHandler = new SearchToolHandler(searchService);
    // Conditionally initialize researchToolHandler
    if (researchOrchestrator) {
      this.researchToolHandler = new ResearchToolHandler(researchOrchestrator);
    } else {
      this.researchToolHandler = null as any; // Or handle this more gracefully
      console.warn('ResearchToolHandler not initialized as LLM/ResearchOrchestrator is unavailable.');
    }

    // Register tool handlers
    this.setupToolHandlers(!!llmAdapter); // Pass flag indicating if LLM is available

    // Set up error handling
    this.setupErrorHandling();
  }

  /**
   * Registers tool handlers with the MCP server
   */
  private setupToolHandlers(isLlmAvailable: boolean) {
    // Use any[] for availableTools to accommodate structurally different tool definitions
    const availableTools: any[] = [searchToolDefinition];
    if (isLlmAvailable && this.researchToolHandler) {
      availableTools.push(researchToolDefinition);
    }

    // Register tool definitions
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: availableTools,
    }));

    // Register tool request handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      if (request.params.name === searchToolDefinition.name) {
        return this.searchToolHandler.handleSearchRequest(request.params.arguments);
      }
      else if (isLlmAvailable && this.researchToolHandler && request.params.name === researchToolDefinition.name) {
        return this.researchToolHandler.handleResearchRequest(request.params.arguments);
      }
      else if (!isLlmAvailable && request.params.name === researchToolDefinition.name) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Tool "${researchToolDefinition.name}" is unavailable because no LLM provider is configured.`
        );
      }
      else {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }
    });
  }

  /**
   * Sets up error handling for the server
   */
  private setupErrorHandling() {
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    
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

    // Handle shutdown
    const cleanup = async () => {
      await this.server.close();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}
