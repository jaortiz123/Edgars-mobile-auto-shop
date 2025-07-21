import React, { useReducer, useEffect, type ReactNode } from 'react'
import { authService } from '../services/authService'
import { AuthStateContext, AuthDispatchContext, initialState, type State, type Action } from './contexts'

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_USER':
      return { ...state, user: action.payload, isLoading: false, error: null }
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    case 'LOGOUT':
      return { ...state, user: null, isLoading: false, error: null }
    default:
      return state
  }
}

export const AuthProvider = React.memo(({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    // Check if user is logged in on app startup
    const checkAuth = async () => {
      try {
        if (authService.isLoggedIn()) {
          const profile = await authService.getProfile()
          const token = authService.parseToken()
          dispatch({ type: 'SET_USER', payload: { 
            email: token?.email || profile.email, 
            profile 
          } })
        } else {
          dispatch({ type: 'SET_LOADING', payload: false })
        }
      } catch {
        // Token might be invalid, clear it
        authService.clearToken()
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    checkAuth()
  }, [])

  return (
    <AuthStateContext.Provider value={state}>
      <AuthDispatchContext.Provider value={dispatch}>
        {children}
      </AuthDispatchContext.Provider>
    </AuthStateContext.Provider>
  )
})
