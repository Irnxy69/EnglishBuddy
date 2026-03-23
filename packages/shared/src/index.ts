export interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

export interface ConversationScore {
  pronunciation: number;
  grammar: number;
  vocabulary: number;
  fluency: number;
}
