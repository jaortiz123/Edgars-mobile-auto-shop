import React, { createContext, useReducer, type ReactNode } from 'react'

interface State {
  user: { username: string } | null
}

const initialState: State = { user: null }

type Action = { type: 'setUser'; payload: { username: string } | null }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setUser':
      return { ...state, user: action.payload }
    default:
      return state
  }
}

export const AuthStateContext = createContext<State>(initialState)
export const AuthDispatchContext = createContext<React.Dispatch<Action>>(() => {})

export const AuthProvider = React.memo(({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <AuthStateContext.Provider value={state}>
      <AuthDispatchContext.Provider value={dispatch}>
        {children}
      </AuthDispatchContext.Provider>
    </AuthStateContext.Provider>
  )
})

export const AuthDispatchProvider = AuthProvider
