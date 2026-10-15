import { createContext } from 'react';
export const MessageRoleContext = createContext<'user' | 'assistant' | 'system'>('assistant');
