/**
 * Core research service with main business logic
 */
import { v4 as uuidv4 } from 'uuid';
import { LLMAdapter } from '../../adapters/llm/llmAdapter.js';
import { SYNTHESIS_PROMPT } from '../prompts/researchPrompts.js';
import { 
  ResearchRequest, 
  ResearchState, 
  ResearchResult,
  AgentDecision,
  Citation,
  SubQuery
} from '../types/research.js';
import { SerperResponse } from '../types/serper.js';
import { config } from '../../infrastructure/config/environment.js';

/**
 * Service for core research functionality
 */
export class ResearchService {
  /**
   * Initializes a new research state
   */
  initializeState(request: ResearchRequest): ResearchState {
    return {
      originalQuery: request.query,
      subQueries: [],
      searchResults: [],
      completedSubQueries: [],
      pendingSubQueries: [],
      citations: [],
      status: 'in_progress'
    };
  }
  
  /**
   * Updates state based on agent decision
   */
  processAgentDecision(
    state: ResearchState, 
    decision: AgentDecision
  ): ResearchState {
    // Clone state to avoid direct mutations
    const newState = { ...state };
    
    if (decision.action === 'research_complete') {
      newState.status = 'complete';
    }
    
    return newState;
  }
  
  /**
   * Updates state with new search results
   */
  updateStateWithResults(
    state: ResearchState, 
    query: string, 
    results: SerperResponse
  ): ResearchState {
    // Clone state to avoid direct mutations
    const newState = { 
      ...state,
      searchResults: [...state.searchResults],
      completedSubQueries: [...state.completedSubQueries],
      pendingSubQueries: [...state.pendingSubQueries],
      citations: [...state.citations]
    };
    
    // Add new search result
    newState.searchResults.push({
      query,
      results,
      timestamp: Date.now()
    });
    
    // Update completed queries
    if (!newState.completedSubQueries.includes(query)) {
      newState.completedSubQueries.push(query);
    }
    
    // Remove from pending queries if present
    newState.pendingSubQueries = newState.pendingSubQueries.filter(q => q !== query);
    
    // Update subquery status
    newState.subQueries = newState.subQueries.map(sq => 
      sq.query === query ? { ...sq, status: 'completed' } : sq
    );
    
    // Extract citations from results
    const newCitations = this.extractCitationsFromResults(query, results);
    newState.citations = [...newState.citations, ...newCitations];
    
    return newState;
  }
  
  /**
   * Updates state with new sub-queries
   */
  updateStateWithSubQueries(
    state: ResearchState, 
    subQueries: SubQuery[]
  ): ResearchState {
    // Clone state to avoid direct mutations
    const newState = { 
      ...state,
      subQueries: [...state.subQueries],
      pendingSubQueries: [...state.pendingSubQueries]
    };
    
    // Add sub-queries that aren't already in the state
    const existingQueries = new Set([
      ...newState.completedSubQueries,
      ...newState.pendingSubQueries,
      ...newState.subQueries.map(sq => sq.query)
    ]);
    
    subQueries.forEach(sq => {
      if (!existingQueries.has(sq.query)) {
        newState.pendingSubQueries.push(sq.query);
        newState.subQueries.push(sq);
        existingQueries.add(sq.query);
      }
    });
    
    return newState;
  }
  
  /**
   * Synthesizes final research results
   */
  async synthesizeResults(
    state: ResearchState,
    llmAdapter: LLMAdapter,
    depth: 'basic' | 'standard' | 'deep' = 'standard'
  ): Promise<ResearchResult> {
    // Format search results for the synthesis prompt
    const formattedResults = this.formatSearchResultsForSynthesis(state);
    
    // Replace template variables in the prompt
    const filledPrompt = SYNTHESIS_PROMPT
      .replace('{{originalQuery}}', state.originalQuery)
      .replace('{{formattedSearchResults}}', formattedResults);
    
    // Get depth-specific temperature for synthesis
    const depthSettings = config.researchDepthSettings[depth];
    const temperature = depthSettings.temperature.synthesis;
    
    // Request synthesis from LLM
    const synthesisText = await llmAdapter.generateCompletion(filledPrompt, {
      temperature,
      maxTokens: depth === 'deep' ? 4000 : (depth === 'standard' ? 3000 : 2000)
    });
    
    return {
      answer: synthesisText,
      citations: state.citations,
      subQueriesGenerated: state.subQueries.length,
      subQueriesCompleted: state.completedSubQueries.length,
      searchesPerformed: state.searchResults.length
    };
  }
  
  /**
   * Extracts citations from search results
   */
  private extractCitationsFromResults(query: string, results: SerperResponse): Citation[] {
    const citations: Citation[] = [];
    
    if (results.organic && Array.isArray(results.organic)) {
      results.organic.forEach((result, index) => {
        if (result.title && result.link) {
          citations.push({
            id: uuidv4(),
            title: result.title,
            url: result.link,
            snippet: result.snippet || '',
            relevanceScore: 1 - (index * 0.1) // Simple relevance score based on position
          });
        }
      });
    }
    
    return citations;
  }
  
  /**
   * Formats search results for synthesis prompt
   */
  private formatSearchResultsForSynthesis(state: ResearchState): string {
    if (state.searchResults.length === 0) {
      return 'No search results available.';
    }
    
    // Group results by sub-query
    const resultsByQuery = new Map<string, Array<any>>();
    
    // First find all unique queries
    state.searchResults.forEach(result => {
      if (!resultsByQuery.has(result.query)) {
        resultsByQuery.set(result.query, []);
      }
      resultsByQuery.get(result.query)?.push(result);
    });
    
    // Then format each query group
    const allFormattedResults: string[] = [];
    
    // Find the corresponding SubQuery object to get the rationale
    const getQueryRationale = (query: string): string => {
      const subQuery = state.subQueries.find(sq => sq.query === query);
      return subQuery?.rationale || 'No rationale available';
    };
    
    // Start with a summary of the research approach
    allFormattedResults.push(`# Research Summary\n`);
    allFormattedResults.push(`Original Query: "${state.originalQuery}"\n`);
    allFormattedResults.push(`Total Search Queries Performed: ${state.completedSubQueries.length}\n`);
    allFormattedResults.push(`Total Sources Found: ${state.citations.length}\n\n`);
    
    // Format each query group with its rationale
    let sourceIndex = 1;
    
    Array.from(resultsByQuery.entries()).forEach(([query, results]) => {
      // Add the query and its rationale
      const rationale = getQueryRationale(query);
      allFormattedResults.push(`## Results for Sub-Query: "${query}"`);
      allFormattedResults.push(`Research Objective: ${rationale}\n`);
      
      // Format each result
      results.forEach(result => {
        const organicResults = result.results.organic || [];
        
        // Add knowledge graph if available
        if (result.results.knowledgeGraph) {
          const kg = result.results.knowledgeGraph;
          allFormattedResults.push(`### Knowledge Graph Result:`);
          allFormattedResults.push(`Title: ${kg.title || 'No title'}`);
          if (kg.description) {
            allFormattedResults.push(`Description: ${kg.description}`);
          }
          if (kg.attributes && Object.keys(kg.attributes).length > 0) {
            allFormattedResults.push(`Key Attributes:`);
            Object.entries(kg.attributes).forEach(([key, value]) => {
              allFormattedResults.push(`- ${key}: ${value}`);
            });
          }
          allFormattedResults.push(``);
        }
        
        // Format search results
        const formattedResults = organicResults
          .slice(0, 5)
          .map((r: any, i: number) => {
            const resultNum = sourceIndex++;
            return `[${resultNum}] **${r.title}**\nURL: ${r.link}\nSnippet: ${r.snippet || 'No snippet available'}\n`;
          })
          .join('\n');
        
        allFormattedResults.push(formattedResults);
      });
      
      // Add a separator between query groups
      allFormattedResults.push(`\n${'='.repeat(80)}\n`);
    });
    
    return allFormattedResults.join('\n');
  }
}
