import { createContext } from 'react'
import type { ProfileData } from '../services/authService'

export interface User {
  email: string;
  profile?: ProfileData;
}

export interface State {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export const initialState: State = {
  user: null,
  isLoading: true,
  error: null
}

export type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'LOGOUT' }

export const AuthStateContext = createContext<State>(initialState)
export const AuthDispatchContext = createContext<React.Dispatch<Action>>(() => {})
