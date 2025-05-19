/**
 * Google Generative AI API client for LLM operations
 */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from '../config/environment.js'; // To get the API key and model
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ChatMessage } from './openRouterClient.js'; // Re-use ChatMessage type for now

// Define safety settings for Google GenAI
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export interface GoogleGenAiCompletionOptions {
  temperature?: number;
  maxOutputTokens?: number; // Note: Google uses maxOutputTokens
  topP?: number;
  // stopSequences?: string[]; // Google uses stopSequences
}

export class GoogleGenAIClient {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string) {
    if (!apiKey) {
      console.warn('GoogleGenAIClient initialized without an API key. API calls will fail.');
      // Avoid throwing here to let the server start; errors will occur on use.
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName || config.llmModel; // Fallback to global config model if specific one not passed

    console.debug('Instantiating GoogleGenAIClient...');
    console.debug('Google API Key:', apiKey ? `${apiKey.substring(0, 5)}...` : 'Not provided');
    console.debug('Google Model:', this.modelName);
  }

  /**
   * Generates a completion from the provided prompt (simulating for chat model)
   * Google's newer models are primarily chat-based. We'll use generateContent.
   */
  async completion(prompt: string, options?: GoogleGenAiCompletionOptions): Promise<string> {
    if (!this.genAI || !this.genAI.apiKey) { // Check if apiKey was actually provided during construction
        throw new McpError(ErrorCode.InvalidRequest, 'Google API Key is not configured for GoogleGenAIClient. Cannot process LLM completion.');
    }
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        safetySettings,
        generationConfig: {
          candidateCount: 1,
          // stopSequences: options?.stopSequences,
          maxOutputTokens: options?.maxOutputTokens ?? 2048, // Default from Google
          temperature: options?.temperature ?? 0.7, // Default, adjust as needed
          topP: options?.topP,
        },
      });
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error: any) {
      console.error('Google GenAI API error in completion:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Google GenAI API error: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Generates a chat completion from the provided messages
   * TODO: Adapt ChatMessage to Google's format if different, or transform.
   * Google's format is { role: "user" | "model", parts: [{ text: "..." }] }
   */
  async chatCompletion(messages: ChatMessage[], options?: GoogleGenAiCompletionOptions): Promise<string> {
    if (!this.genAI || !this.genAI.apiKey) {
        throw new McpError(ErrorCode.InvalidRequest, 'Google API Key is not configured for GoogleGenAIClient. Cannot process LLM chat completion.');
    }
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        safetySettings,
        generationConfig: {
          candidateCount: 1,
          // stopSequences: options?.stopSequences,
          maxOutputTokens: options?.maxOutputTokens ?? 2048,
          temperature: options?.temperature ?? 0.7,
          topP: options?.topP,
        },
      });

      // Transform messages to Google's format
      const googleMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role, // 'assistant' maps to 'model'
        parts: [{ text: msg.content }],
      }));

      // For chat, history is passed directly to startChat
      const chat = model.startChat({
        history: googleMessages.slice(0, -1), // All but the last message as history
      });
      const lastMessage = googleMessages[googleMessages.length - 1];
      
      const result = await chat.sendMessage(lastMessage.parts[0].text); // Send the last user message
      const response = result.response;
      return response.text();
    } catch (error: any) {
      console.error('Google GenAI API error in chatCompletion:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Google GenAI API error: ${error.message || 'Unknown error'}`
      );
    }
  }
}