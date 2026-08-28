/** Standard backend envelope (§23). */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
}

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface TokenData {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserPublic;
}

export interface HealthData {
  status: string;
  version: string;
  time: string;
  database_connected: boolean;
  amadeus_configured: boolean;
  environment: string;
  features?: {
    pdf_export: boolean;
    fare_prediction: boolean;
    ai_assistant: boolean;
  };
}
