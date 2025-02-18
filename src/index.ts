#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError } from 'axios';

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') })
// Environment variable check
const API_KEY = process.env.SERPER_API_KEY;
if (!API_KEY) {
  throw new Error('SERPER_API_KEY environment variable is required. Please set it in your configuration.');
}

// TypeScript interfaces for Serper API responses
interface SearchParameters {
  q: string;
  gl?: string;
  hl?: string;
  autocorrect?: boolean;
  page?: number;
  type: 'search';
}

interface KnowledgeGraph {
  title: string;
  type: string;
  website?: string;
  imageUrl?: string;
  description?: string;
  descriptionSource?: string;
  descriptionLink?: string;
  attributes: Record<string, string>;
}

interface Sitelink {
  title: string;
  link: string;
}

interface OrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  sitelinks?: Sitelink[];
  attributes?: Record<string, string>;
  date?: string;
}

interface PeopleAlsoAskItem {
  question: string;
  snippet: string;
  title?: string;
  link: string;
}

interface RelatedSearch {
  query: string;
}

interface SerperResponse {
  searchParameters: SearchParameters;
  knowledgeGraph?: KnowledgeGraph;
  organic: OrganicResult[];
  peopleAlsoAsk?: PeopleAlsoAskItem[];
  relatedSearches?: RelatedSearch[];
}

interface SearchArgs {
  query: string;
  numResults?: number;
  gl?: string;
  hl?: string;
  autocorrect?: boolean;
}

class SerperSearchServer {
  private server: Server;
  private axiosInstance;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private readonly RATE_LIMIT = 50; // requests per minute
  private readonly RATE_WINDOW = 60000; // 1 minute in milliseconds

  constructor() {
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

    this.axiosInstance = axios.create({
      baseURL: 'https://google.serper.dev',
      headers: {
        'X-API-KEY': API_KEY,
      },
      timeout: 10000, // 10 second timeout
    });

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private validateSearchArgs(args: any): args is SearchArgs {
    if (typeof args !== 'object' || args === null) {
      throw new McpError(ErrorCode.InvalidParams, 'Arguments must be an object');
    }

    if (typeof args.query !== 'string' || !args.query.trim()) {
      throw new McpError(ErrorCode.InvalidParams, 'Query must be a non-empty string');
    }

    if (args.numResults !== undefined && (
      typeof args.numResults !== 'number' ||
      args.numResults < 1 ||
      args.numResults > 100
    )) {
      throw new McpError(ErrorCode.InvalidParams, 'numResults must be between 1 and 100');
    }

    if (args.gl !== undefined && (
      typeof args.gl !== 'string' ||
      !/^[a-z]{2}$/.test(args.gl)
    )) {
      throw new McpError(ErrorCode.InvalidParams, 'gl (country) must be a valid 2-letter country code');
    }

    if (args.hl !== undefined && (
      typeof args.hl !== 'string' ||
      !/^[a-z]{2}(-[A-Z]{2})?$/.test(args.hl)
    )) {
      throw new McpError(ErrorCode.InvalidParams, 'hl (language) must be a valid language code');
    }

    if (args.autocorrect !== undefined && typeof args.autocorrect !== 'boolean') {
      throw new McpError(ErrorCode.InvalidParams, 'autocorrect must be a boolean');
    }

    return true;
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.lastRequestTime >= this.RATE_WINDOW) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    if (this.requestCount >= this.RATE_LIMIT) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Rate limit of ${this.RATE_LIMIT} requests per minute exceeded`
      );
    }

    this.requestCount++;
    return true;
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'serper-google-search',
          description: 'Perform a Google search using the SERPER API. Returns rich search results including knowledge graph, organic results, related questions, and more.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              numResults: {
                type: 'number',
                description: 'Number of results to return (default: 10)',
                minimum: 1,
                maximum: 100,
              },
              gl: {
                type: 'string',
                description: 'Country code (e.g., "us", "uk")',
                pattern: '^[a-z]{2}$',
              },
              hl: {
                type: 'string',
                description: 'Language code (e.g., "en", "es")',
                pattern: '^[a-z]{2}(-[A-Z]{2})?$',
              },
              autocorrect: {
                type: 'boolean',
                description: 'Enable query autocorrection',
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'serper-google-search') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      try {
        if (!this.validateSearchArgs(request.params.arguments)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid search arguments');
        }
        this.checkRateLimit();

        const args = request.params.arguments as SearchArgs;
        const { query, numResults = 10, gl, hl, autocorrect } = args;

        const response = await this.axiosInstance.post<SerperResponse>('/search', {
          q: query,
          num: numResults,
          gl,
          hl,
          autocorrect,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          return {
            content: [
              {
                type: 'text',
                text: `SERPER API error: ${
                  (axiosError.response?.data as { message?: string })?.message ?? axiosError.message
                }`,
              },
            ],
            isError: true,
          };
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Unexpected error: ${(error as Error).message}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Serper Search MCP server running on stdio');
  }
}

const server = new SerperSearchServer();
server.run().catch(console.error);
