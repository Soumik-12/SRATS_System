import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

export interface GenerateContentOptions {
  model?: string;
  contents: string | Array<any>;
  systemInstruction?: string;
  config?: Record<string, any>;
  timeoutMs?: number;
}

export interface GeminiResponse {
  text: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export interface IGeminiClient {
  isConfigured(): boolean;
  getModel(): string;
  generateContent(options: GenerateContentOptions): Promise<GeminiResponse>;
}

export function resolveValidModel(modelCandidate?: string): string {
  if (!modelCandidate || typeof modelCandidate !== 'string') {
    return 'gemini-3.8-flash';
  }
  const trimmed = modelCandidate.trim();
  if (trimmed.startsWith('gemini-') || trimmed.startsWith('veo-') || trimmed.startsWith('lyria-')) {
    return trimmed;
  }
  return 'gemini-3.8-flash';
}

/**
 * Standard Production Server-Only Gemini Client using @google/genai
 */
export class GeminiClient implements IGeminiClient {
  private ai: GoogleGenAI | null = null;
  private defaultModel: string;

  constructor() {
    this.defaultModel = resolveValidModel(process.env.GEMINI_MODEL || config.geminiModel);
    this.initClient();
  }

  private initClient(): void {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (apiKey && apiKey.length > 0 && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        this.ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
        logger.info('Gemini AI client successfully initialized with server-side credentials', {
          model: this.defaultModel,
        });
      } catch (err) {
        logger.error('Failed to initialize GoogleGenAI client with provided key', err);
        this.ai = null;
      }
    } else {
      logger.warn('Gemini API key is not configured. AI features will degrade gracefully.');
      this.ai = null;
    }
  }

  public isConfigured(): boolean {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    return Boolean(apiKey && apiKey.length > 0 && apiKey !== 'MY_GEMINI_API_KEY');
  }

  public getModel(): string {
    return resolveValidModel(process.env.GEMINI_MODEL || config.geminiModel || this.defaultModel);
  }

  /**
   * Generates content via @google/genai with strict timeout and sanitized error handling.
   */
  public async generateContent(options: GenerateContentOptions): Promise<GeminiResponse> {
    if (!this.isConfigured() || !this.ai) {
      throw new AppError(
        503,
        'AI_SERVICE_UNAVAILABLE',
        'AI assistance is temporarily unavailable. You can continue using SRATS normally.'
      );
    }

    const modelToUse = resolveValidModel(options.model || this.getModel());
    const timeoutMs = options.timeoutMs || 25000;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new AppError(504, 'AI_TIMEOUT', 'AI request timed out while generating content.'));
      }, timeoutMs);
    });

    try {
      const callPromise = (async () => {
        const params: any = {
          model: modelToUse,
          contents: options.contents,
        };

        const callConfig: Record<string, any> = { ...(options.config || {}) };
        if (options.systemInstruction) {
          callConfig.systemInstruction = options.systemInstruction;
        }

        if (Object.keys(callConfig).length > 0) {
          params.config = callConfig;
        }

        let response: any;
        try {
          response = await this.ai!.models.generateContent(params);
        } catch (apiErr: any) {
          const errStatus = apiErr?.status || apiErr?.statusCode;
          const errMsg = String(apiErr?.message || '');
          const isUnavailable =
            errStatus === 503 ||
            errMsg.includes('UNAVAILABLE') ||
            errMsg.includes('high demand');
          if (isUnavailable && modelToUse === 'gemini-3.8-flash') {
            logger.info('Gemini 3.8-flash experiencing high demand; failing over to gemini-3.1-flash-lite', {
              model: 'gemini-3.1-flash-lite',
            });
            response = await this.ai!.models.generateContent({
              ...params,
              model: 'gemini-3.1-flash-lite',
            });
          } else {
            throw apiErr;
          }
        }

        const text = response.text || '';
        return {
          text,
          usageMetadata: response.usageMetadata
            ? {
                promptTokenCount: response.usageMetadata.promptTokenCount,
                candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
                totalTokenCount: response.usageMetadata.totalTokenCount,
              }
            : undefined,
        };
      })();

      return await Promise.race([callPromise, timeoutPromise]);
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }

      // Sanitize provider errors: never leak API keys, endpoints, or full internal stack traces
      const errorMsg = String(error?.message || error || '');
      const sanitizedMsg = errorMsg.replace(/AIzaSy[A-Za-z0-9_-]+/g, '[REDACTED_API_KEY]');
      const status = error?.status || error?.statusCode || 0;

      if (status === 429 || sanitizedMsg.includes('RESOURCE_EXHAUSTED') || sanitizedMsg.includes('429')) {
        throw new AppError(
          429,
          'AI_RATE_LIMITED',
          'AI provider rate limit reached. Please wait a moment and try again.'
        );
      }

      if (
        status === 503 ||
        sanitizedMsg.includes('UNAVAILABLE') ||
        sanitizedMsg.includes('503') ||
        sanitizedMsg.includes('high demand')
      ) {
        throw new AppError(
          503,
          'AI_SERVICE_UNAVAILABLE',
          'AI assistance is temporarily experiencing high demand. Please try again shortly.'
        );
      }

      logger.error(
        'Gemini API call failed with provider error',
        error instanceof Error ? error : new Error(sanitizedMsg),
        {
          sanitizedMessage: sanitizedMsg,
          model: modelToUse,
        }
      );

      throw new AppError(
        500,
        'AI_GENERATION_FAILED',
        'Failed to process request with AI provider. Please retry.'
      );
    }
  }
}

// Singleton and mock injection support for automated tests
let activeClient: IGeminiClient = new GeminiClient();

export function getGeminiClient(): IGeminiClient {
  return activeClient;
}

export function setMockGeminiClient(mockClient: IGeminiClient): void {
  activeClient = mockClient;
}

export function resetGeminiClient(): void {
  activeClient = new GeminiClient();
}
