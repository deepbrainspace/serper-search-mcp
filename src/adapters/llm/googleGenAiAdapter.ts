/**
 * LLM Adapter for Google Generative AI
 */
import { LLMAdapter } from './llmAdapter.js';
import { GoogleGenAIClient, GoogleGenAiCompletionOptions } from '../../infrastructure/api/googleGenAiClient.js';
import { 
  ChatMessage, 
  CompletionOptions as OpenRouterCompletionOptions, // Alias to avoid confusion
  ChatCompletionOptions as OpenRouterChatCompletionOptions, // Alias
  ChatResponse 
} from '../../infrastructure/api/openRouterClient.js'; // Still use these for interface compatibility

export class GoogleGenAIAdapter implements LLMAdapter {
  private client: GoogleGenAIClient;

  constructor(client: GoogleGenAIClient) {
    this.client = client;
  }

  /**
   * Maps OpenRouter-style CompletionOptions to GoogleGenAiCompletionOptions
   */
  private mapToGoogleOptions(options?: OpenRouterCompletionOptions): GoogleGenAiCompletionOptions | undefined {
    if (!options) return undefined;
    return {
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens, // Map maxTokens to maxOutputTokens
      // stopSequences: options.stop, // Map stop to stopSequences if needed
    };
  }

  /**
   * Maps OpenRouter-style ChatCompletionOptions to GoogleGenAiCompletionOptions
   */
  private mapToGoogleChatOptions(options?: OpenRouterChatCompletionOptions): GoogleGenAiCompletionOptions | undefined {
    if (!options) return undefined;
    return {
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      topP: options.topP,
      // stopSequences: options.stop,
      // frequencyPenalty and presencePenalty are not directly available in Google's basic config,
      // they might be part of more advanced settings or not supported for all models.
    };
  }

  async generateCompletion(prompt: string, options?: OpenRouterCompletionOptions): Promise<string> {
    const googleOptions = this.mapToGoogleOptions(options);
    return this.client.completion(prompt, googleOptions);
  }

  async generateChatCompletion(messages: ChatMessage[], options?: OpenRouterChatCompletionOptions): Promise<ChatResponse> {
    const googleOptions = this.mapToGoogleChatOptions(options);
    const textResponse = await this.client.chatCompletion(messages, googleOptions);

    // Adapt the string response to the ChatResponse structure expected by the interface
    // This is a simplified adaptation.
    return {
      id: `google-${Date.now()}`, // Generate a pseudo-ID
      model: this.client['modelName'] || 'google-gemini', // Access modelName if possible, otherwise a generic name
      choices: [
        {
          message: {
            role: 'assistant',
            content: textResponse,
          },
          finishReason: 'stop', // Assuming 'stop' as Google's API usually stops on completion
        },
      ],
    };
  }
}