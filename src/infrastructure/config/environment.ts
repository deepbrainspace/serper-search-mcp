/**
 * Environment configuration and validation
 */
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import * as fs from 'fs';
import { resolvePostHogConfig } from './posthogConfig.js';

// Get the directory path for loading the .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const executionDir = process.cwd(); // Get the directory where the command was executed

// Load environment variables from .env file in the execution directory
dotenv.config({ path: resolve(executionDir, '.env') });

// Provide debugging info for path resolution
console.debug('Executing from directory:', executionDir);
console.debug('Attempting to load .env from:', resolve(executionDir, '.env'));
console.debug('.env exists in execution directory:', fs.existsSync(resolve(executionDir, '.env')));

// --- LLM Configuration ---
const DEFAULT_GOOGLE_MODEL = "gemini-2.0-flash-lite-preview-02-05"; // User requested default
const DEFAULT_OPENROUTER_MODEL = "google/gemini-flash-1.5"; // Or your preferred OpenRouter default

// Read unified LLM environment variables
const envSerperLlmApiKey = process.env.SERPER_LLM_API_KEY || '';
const envSerperLlmProvider = (process.env.SERPER_LLM_PROVIDER || "google").toLowerCase() as 'google' | 'openrouter'; // Default to google
const envSerperLlmModelOverride = process.env.SERPER_LLM_MODEL || '';

let llmProvider: 'google' | 'openrouter' | null = null;
let llmApiKey: string = '';
let llmModel: string = '';

if (envSerperLlmApiKey) {
  if (envSerperLlmProvider === 'google') {
    llmProvider = 'google';
    llmApiKey = envSerperLlmApiKey;
    llmModel = envSerperLlmModelOverride || DEFAULT_GOOGLE_MODEL;
  } else if (envSerperLlmProvider === 'openrouter') {
    llmProvider = 'openrouter';
    llmApiKey = envSerperLlmApiKey;
    llmModel = envSerperLlmModelOverride || DEFAULT_OPENROUTER_MODEL;
  } else {
    // SERPER_LLM_PROVIDER is set to something invalid, but an API key is present.
    // Default to "google" as per SERPER_LLM_PROVIDER's default behavior.
    console.warn(`Invalid SERPER_LLM_PROVIDER "${process.env.SERPER_LLM_PROVIDER}". Defaulting to "google" as LLM provider.`);
    llmProvider = 'google';
    llmApiKey = envSerperLlmApiKey;
    llmModel = envSerperLlmModelOverride || DEFAULT_GOOGLE_MODEL;
  }
} else {
  console.debug('SERPER_LLM_API_KEY not provided. LLM features will be unavailable.');
  // llmProvider, llmApiKey, llmModel remain null/empty
}

console.debug(`Selected LLM Provider: ${llmProvider || 'None'}`);
console.debug(`Selected LLM Model: ${llmModel || 'N/A'}`);
console.debug(`LLM API Key will be used: ${llmApiKey ? 'Yes' : 'No'}`);
// --- End LLM Configuration ---

// Configuration constants
export const RATE_LIMIT = 50; // requests per minute
export const RATE_WINDOW = 60000; // 1 minute in milliseconds
export const REQUEST_TIMEOUT = 10000; // 10 seconds

// Environment variable validation
const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} environment variable is required. Please set it in your configuration.`);
  }
  return value;
};

// Export config values
export const config = {
  serperApiKey: getRequiredEnv('SERPER_API_KEY'),
  serperApiUrl: 'https://google.serper.dev',
  
  // PostHog config - uses shipped defaults unless overridden by env vars
  posthog: resolvePostHogConfig(),

  // LLM Provider Config
  llmProvider: llmProvider,
  llmApiKey: llmApiKey,
  llmModel: llmModel,
  
  // Specific provider URLs/configs (legacy openRouterApiKey and openRouterModel are effectively superseded by llmApiKey/llmModel when provider is openrouter)
  openRouterUrl: 'https://openrouter.ai/api/v1',
  // googleApiUrl: 'https://generativelanguage.googleapis.com' // Example, actual SDK might not need this if it handles it

  // Research depth settings
  researchDepthSettings: {
    basic: { 
      maxSubQueries: 4, 
      maxSearchesPerQuery: 1,
      maxIterations: 6,
      temperature: {
        decision: 0.3,      // More focused decisions
        subqueries: 0.7,    // Creative sub-query generation
        synthesis: 0.4      // Balanced synthesis
      }
    },
    standard: { 
      maxSubQueries: 7, 
      maxSearchesPerQuery: 2,
      maxIterations: 15,
      temperature: {
        decision: 0.25,     // More focused decisions
        subqueries: 0.65,   // Balance of creativity and focus
        synthesis: 0.35     // More structured synthesis
      }
    },
    deep: { 
      maxSubQueries: 12, 
      maxSearchesPerQuery: 4,
      maxIterations: 25,
      temperature: {
        decision: 0.2,      // Highly analytical decisions
        subqueries: 0.6,    // Strategic sub-query generation
        synthesis: 0.3      // Highly structured synthesis
      },
      additionalFeatures: {
        exploreBreadth: true,       // Explore multiple angles
        deepDive: true,             // Explore topics in depth
        crossReferenceResults: true // Compare information across sources
      }
    }
  }
};
