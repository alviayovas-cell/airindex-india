import { http, request } from "./client";
import type { ApiResponse } from "@/types/api";

export interface AiStatus {
  enabled: boolean;
  engine: string;
  model: string | null;
}

export interface AiAnswer {
  answer: string;
  engine: string;
  model: string | null;
  note?: string;
  context_fields: string[];
}

export interface AiTurn {
  role: "user" | "assistant";
  content: string;
}

export function fetchAiStatus(): Promise<AiStatus> {
  return request<AiStatus>(http.get<ApiResponse<AiStatus>>("/ai/status"));
}

export function askAi(question: string, history: AiTurn[]): Promise<AiAnswer> {
  return request<AiAnswer>(
    http.post<ApiResponse<AiAnswer>>("/ai/ask", { question, history }),
  );
}
