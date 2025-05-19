# Serper Search MCP Server

A Model Context Protocol server that provides Google search capabilities through the Serper API, along with an AI-powered Deep Research tool. This server enables easy integration of search and research functionality into your MCP-enabled applications.

## ✨ Features

- 🌐 Powerful Google search integration through Serper API
- 🔄 Rich search response data including:
  - Knowledge Graph information
  - Organic search results
  - "People Also Ask" questions
  - Related searches
- 🧠 AI-powered Deep Research tool:
  - Performs multi-step, iterative research
  - Generates sub-queries to explore topics thoroughly
  - Synthesizes information from multiple sources
  - Provides citations for all information
  - Adjustable research depth levels
  - Built-in quality metrics for continuous improvement
- 🛠 Configurable search parameters:
  - Country targeting
  - Language selection
  - Result count customization
  - Autocorrect options
- 🔒 Secure API key handling
- ⚡️ Rate limiting and caching support
- 📝 TypeScript support with full type definitions
- 📊 Integrated performance metrics for result optimization

## 🚀 Installation

To use the Serper Search MCP server, you can run it directly using `npx` or install it globally.

**Using NPX (recommended for quick use):**
No installation step is needed. You can run the server directly (see "Usage with NPX" section below).

**Global Installation (optional):**
```bash
pnpm add -g @nayeemsyed/serper-search-mcp
```
Or using npm:
```bash
npm install -g @nayeemsyed/serper-search-mcp
```

## ⚙️ Configuration

1. Get your Serper API key from [Serper.dev](https://serper.de

2. Create a `.env` file in the root directory where you run the server (e.g., when using `npx`):
```env
# --- Required for basic search ---
SERPER_API_KEY=your_api_key_here

# --- Optional: LLM Configuration for Deep Research tool ---
# The Deep Research tool requires an LLM. Configure it using the variables below.
# If SERPER_LLM_API_KEY is not provided, the Deep Research tool will be unavailable.

SERPER_LLM_PROVIDER="google"  # Or "openrouter". Defaults to "google".
SERPER_LLM_API_KEY="your_llm_api_key_here" # Your API key for either Google (Gemini) or OpenRouter.
SERPER_LLM_MODEL=""           # Optional. Override the default model for the chosen provider.
                              # Default for Google: "gemini-2.0-flash-lite-preview-02-05"
                              # Default for OpenRouter: "google/gemini-flash-1.5" (or other suitable model)

# --- Optional: Advanced Quality Metrics Configuration ---
# (These are pre-configured by default)
# USAGE_METRICS_KEY=your-custom-metrics-key
# USAGE_PROJECT_ID=your-custom-project-id
# METRICS_ENDPOINT=https://your-custom-host.com
# DISABLE_METRICS=false # Not recommended
```
**LLM Configuration Details:**
- **`SERPER_LLM_PROVIDER`**: Specifies the LLM provider.
  - `"google"` (default): Uses Google Generative AI (Gemini models). `SERPER_LLM_API_KEY` should be your Google AI Studio API key.
  - `"openrouter"`: Uses OpenRouter. `SERPER_LLM_API_KEY` should be your OpenRouter API key.
- **`SERPER_LLM_API_KEY`**: The API key for your chosen `SERPER_LLM_PROVIDER`.
- **`SERPER_LLM_MODEL`**: (Optional) Specify a particular model to use. If not set, a default model for the chosen provider will be used:
  - Google Default: `gemini-2.0-flash-lite-preview-02-05`
  - OpenRouter Default: `google/gemini-flash-1.5` (or another suitable model like `mistralai/mistral-7b-instruct`)
- If `SERPER_LLM_API_KEY` is not provided, the Deep Research tool will be unavailable.

See [TELEMETRY.md](TELEMETRY.md) for detailed information about:
- Quality metrics collection
- Performance monitoring
- Usage analytics
- Dashboard setup
- Continuous improvement

## 🔌 Integration

### Claude Desktop

Add the server config to your Claude Desktop configuration:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "@nayeemsyed/serper-search-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@nayeemsyed/serper-search-mcp" // You can append @version like @0.2.0 if needed
      ],
      "env": {
        "SERPER_API_KEY": "your_serper_api_key_here",
        // For Deep Research tool (if needed):
        "SERPER_LLM_PROVIDER": "google",  // or "openrouter"
        "SERPER_LLM_API_KEY": "your_actual_llm_api_key",
        "SERPER_LLM_MODEL": "" // Optional: "gemini-2.5-pro-preview-05-06" or other model
        // "DEBUG": "true" // If your server uses this for more verbose logging
      }
    }
  }
}
```
If you installed it globally (e.g., `pnpm add -g @nayeemsyed/serper-search-mcp`), you might be able to use a simpler command, ensuring the environment variables are set in the MCP client's `env` block:
```json
{
  "mcpServers": {
    "@nayeemsyed/serper-search-mcp": {
      "command": "serper-search-mcp", // This is the binary name from your package.json
      "env": {
        "SERPER_API_KEY": "your_serper_api_key_here",
        "SERPER_LLM_PROVIDER": "google", // or "openrouter"
        "SERPER_LLM_API_KEY": "your_actual_llm_api_key"
        // "SERPER_LLM_MODEL": "your_preferred_model" // Optional
      }
    }
  }
}
```

## 🛠 Usage with NPX

You can run the server directly from the command line using `npx`:

```bash
npx @nayeemsyed/serper-search-mcp
```

Make sure you have your `.env` file configured in the directory where you run this command, or set the environment variables (`SERPER_API_KEY`, etc.) in your shell.

If you have it installed globally, you can run:
```bash
serper-search-mcp
```

### Search Tool

### Search Tool

The server provides a powerful search tool with the following parameters:

```typescript
{
  "query": string,          // Search query
  "numResults"?: number,    // Number of results (default: 10, max: 100)
  "gl"?: string,           // Country code (e.g., "us", "uk")
  "hl"?: string,           // Language code (e.g., "en", "es")
  "autocorrect"?: boolean, // Enable autocorrect (default: true)
  "type"?: "search"        // Search type (more types coming soon)
}
```

### Deep Research Tool

For more comprehensive research needs, the server provides a deep research tool that performs multi-step research with the following parameters:

```typescript
{
  "query": string,          // Research query or question
  "depth"?: "basic" | "standard" | "deep",  // Research depth (default: "standard")
  "maxSources"?: number     // Maximum sources to include (default: 10)
}
```

The deep research tool:
- Breaks down complex queries into focused sub-queries
- Executes multiple searches to gather comprehensive information
- Uses AI to synthesize information from multiple sources
- Formats results with proper citations and references
- Adapts its research strategy based on intermediate results
- Collects anonymous quality metrics to improve search results

Depth Levels:
- basic: Quick overview (3-5 sources, ~5 min)
  Good for: Simple facts, quick definitions, straightforward questions
- standard: Comprehensive analysis (5-10 sources, ~10 min)
  Good for: Most research needs, balanced depth and speed
- deep: Exhaustive research (10+ sources, ~15-20 min)
  Good for: Complex topics, academic research, thorough analysis

### Search Tool Example Response

The search results include rich data:

```json
{
  "searchParameters": {
    "q": "apple inc",
    "gl": "us",
    "hl": "en",
    "autocorrect": true,
    "type": "search"
  },
  "knowledgeGraph": {
    "title": "Apple",
    "type": "Technology company",
    "website": "http://www.apple.com/",
    "description": "Apple Inc. is an American multinational technology company...",
    "attributes": {
      "Headquarters": "Cupertino, CA",
      "CEO": "Tim Cook (Aug 24, 2011–)",
      "Founded": "April 1, 1976, Los Altos, CA"
    }
  },
  "organic": [
    {
      "title": "Apple",
      "link": "https://www.apple.com/",
      "snippet": "Discover the innovative world of Apple...",
      "position": 1
    }
  ],
  "peopleAlsoAsk": [
    {
      "question": "What does Apple Inc mean?",
      "snippet": "Apple Inc., formerly Apple Computer, Inc....",
      "link": "https://www.britannica.com/topic/Apple-Inc"
    }
  ],
  "relatedSearches": [
    {
      "query": "Who invented the iPhone"
    }
  ]
}
```

## 🔍 Response Types

### Knowledge Graph
Contains entity information when available:
- Title and type
- Website URL
- Description
- Key attributes

### Organic Results
List of search results including:
- Title and URL
- Snippet (description)
- Position in results
- Sitelinks when available

### People Also Ask
Common questions related to the search:
- Question text
- Answer snippet
- Source link

### Related Searches
List of related search queries users often make.

## 📊 Quality Metrics

The Deep Research tool includes integrated quality metrics:

- Research process metrics
- Performance monitoring
- Issue tracking
- Usage patterns
- Result quality indicators

See [TELEMETRY.md](TELEMETRY.md) for detailed information about the metrics collected to improve search quality.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Serper API](https://serper.dev) for providing the Google search capabilities
- [Model Context Protocol](https://github.com/modelcontextprotocol/mcp) for the MCP framework
- [PostHog](https://posthog.com) for analytics capabilities
