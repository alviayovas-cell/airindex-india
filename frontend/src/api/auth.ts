import { http, request } from "./client";
import type { ApiResponse, TokenData, UserPublic } from "@/types/api";

export interface LoginPayload {
  email: string;
  password: string;
  remember_me?: boolean;
}

export function login(payload: LoginPayload): Promise<TokenData> {
  return request<TokenData>(
    http.post<ApiResponse<TokenData>>("/auth/login", payload),
  );
}

export function fetchMe(): Promise<UserPublic> {
  return request<UserPublic>(http.get<ApiResponse<UserPublic>>("/auth/me"));
}
