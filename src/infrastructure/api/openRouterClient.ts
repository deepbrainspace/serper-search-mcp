/**
 * OpenRouter API client for LLM operations
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import { config, REQUEST_TIMEOUT } from '../config/environment.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
}

export interface ChatCompletionOptions extends CompletionOptions {
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface ChatResponse {
  id: string;
  model: string;
  choices: {
    message: ChatMessage;
    finishReason: string;
  }[];
}

// OpenRouterConfig interface can be removed if not used elsewhere, or kept for clarity
// export interface OpenRouterConfig {
//   apiKey: string;
//   model: string;
//   baseUrl: string;
// }

export class OpenRouterClient {
  private axiosInstance: AxiosInstance;
  private model: string;
  private apiKey: string;

  constructor(apiKey: string, model: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.model = model;
    const effectiveBaseUrl = baseUrl || config.openRouterUrl;
        
    // Debug config
    console.debug('Instantiating OpenRouterClient...');
    console.debug('OpenRouter API Key:', this.apiKey ? `${this.apiKey.substring(0, 5)}...` : 'Not provided');
    console.debug('OpenRouter Model:', this.model);
    console.debug('OpenRouter Base URL:', effectiveBaseUrl);
    
    if (!this.apiKey) {
      console.warn('OpenRouterClient initialized without an API key. API calls will likely fail.');
    }
    
    this.axiosInstance = axios.create({
      baseURL: effectiveBaseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://serper-search-server',
        'X-Title': 'Serper Search Deep Research'
      },
      timeout: REQUEST_TIMEOUT,
    });
  }

  /**
   * Generates a completion from the provided prompt
   */
  async completion(prompt: string, options?: CompletionOptions): Promise<string> {
    try {
      const response = await this.axiosInstance.post('/completions', {
        model: this.model,
        prompt,
        temperature: options?.temperature ?? 0.5,
        max_tokens: options?.maxTokens ?? 1024,
        stop: options?.stop
      });

      return response.data.choices[0].text;
    } catch (error) {
      this.handleApiError(error);
      throw error; // This line won't be reached but TypeScript needs it
    }
  }

  /**
   * Generates a chat completion from the provided messages
   */
  async chatCompletion(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<ChatResponse> {
    try {
      const response = await this.axiosInstance.post('/chat/completions', {
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.5,
        max_tokens: options?.maxTokens ?? 1024,
        top_p: options?.topP ?? 0.9,
        frequency_penalty: options?.frequencyPenalty ?? 0,
        presence_penalty: options?.presencePenalty ?? 0,
        stop: options?.stop
      });

      return response.data;
    } catch (error) {
      this.handleApiError(error);
      throw error; // This line won't be reached but TypeScript needs it
    }
  }

  /**
   * Handles API errors and transforms them into McpErrors
   */
  private handleApiError(error: any): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      throw new McpError(
        ErrorCode.InternalError,
        `OpenRouter API error: ${
          (axiosError.response?.data as any)?.error?.message ?? axiosError.message
        }`
      );
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Unexpected error: ${(error as Error).message}`
    );
  }
}
