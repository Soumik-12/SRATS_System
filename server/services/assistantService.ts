import crypto from 'crypto';
import { aiOrchestrator } from '../ai/aiOrchestrator.js';
import { auditLogRepository } from '../repositories/notificationRepository.js';
import type { AiCallerContext } from '../ai/toolRegistry.js';

interface ChatMessage {
  sender: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  timestamp: number;
}

export class AssistantService {
  // Ephemeral in-memory conversation cache (bounded to last 10 messages per conversation)
  private conversations = new Map<string, ChatMessage[]>();

  async chat(
    caller: AiCallerContext,
    userMessage: string,
    existingConversationId?: string
  ): Promise<{
    success: boolean;
    response: string;
    toolCallsExecuted: Array<{ tool: string; args: any; result: any }>;
    modelUsed: string;
    conversationId: string;
  }> {
    const conversationId = existingConversationId || `conv-${caller.userId}-${Date.now().toString(36)}`;

    // Retrieve or initialize conversation history
    let history = this.conversations.get(conversationId) || [];

    // Append new user message
    history.push({
      sender: 'USER',
      content: userMessage,
      timestamp: Date.now(),
    });

    // Keep history bounded to recent turns (max 10 messages)
    if (history.length > 10) {
      history = history.slice(-10);
    }
    this.conversations.set(conversationId, history);

    // Run role-aware assistant orchestrator turn
    const result = await aiOrchestrator.chatWithAssistant(
      history.map((m) => ({ sender: m.sender, content: m.content })),
      caller
    );

    // Append assistant response to history
    history.push({
      sender: 'ASSISTANT',
      content: result.responseText,
      timestamp: Date.now(),
    });
    this.conversations.set(conversationId, history);

    // Audit log the conversation turn
    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
      actor_id: caller.userId,
      action: 'ASSISTANT_CHAT_TURN',
      entity_type: 'AI_ASSISTANT',
      entity_id: caller.userId,
      metadata_json: JSON.stringify({
        conversationId,
        userRole: caller.role,
        toolsExecuted: result.toolCallsExecuted.map((t) => t.tool),
        modelUsed: result.modelUsed,
      }),
    });

    return {
      success: true,
      response: result.responseText,
      toolCallsExecuted: result.toolCallsExecuted,
      modelUsed: result.modelUsed,
      conversationId,
    };
  }

  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }
}

export const assistantService = new AssistantService();
