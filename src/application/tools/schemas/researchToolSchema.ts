/**
 * Schema definition for the Deep Research tool
 */

/**
 * Input schema for the Deep Research tool
 */
export const researchToolInputSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Research query or question',
    },
    depth: {
      type: 'string',
      enum: ['basic', 'standard', 'deep'],
      description: 'Depth of research (basic: quick answers, standard: comprehensive, deep: exhaustive)',
      default: 'standard'
    },
    maxSources: {
      type: 'number',
      description: 'Maximum number of sources to include in the response',
      default: 10
    }
  },
  required: ['query'],
};

/**
 * Tool definition for the Deep Research
 */
export const researchToolDefinition = {
  name: 'deep-research',
  description: `Perform comprehensive research on complex queries using a multi-step process that:
- Breaks down complex questions into focused sub-queries
- Gathers information from multiple authoritative sources
- Synthesizes findings into a well-structured response with citations
- Includes methodology and source assessment

Best for:
- Complex topics requiring multiple perspectives
- Questions needing authoritative sources
- Topics benefiting from structured analysis
- Research requiring citation and source tracking

Depth Levels:
- basic: Quick overview (3-5 sources, ~5 min)
  Good for: Simple facts, quick definitions, straightforward questions
- standard: Comprehensive analysis (5-10 sources, ~10 min)
  Good for: Most research needs, balanced depth and speed
- deep: Exhaustive research (10+ sources, ~15-20 min)
  Good for: Complex topics, academic research, thorough analysis

Example queries:
- "What are the latest developments in quantum computing and their potential impact?"
- "Compare different approaches to microservice architecture patterns"
- "Analyze the environmental impact of electric vehicles vs traditional vehicles"
- "Explain the current state of AI regulation worldwide"
- "Research best practices for scaling Node.js applications"`,
  inputSchema: researchToolInputSchema,
};
