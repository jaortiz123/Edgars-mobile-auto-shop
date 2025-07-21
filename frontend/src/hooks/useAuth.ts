import { useContext } from 'react'
import { AuthStateContext, AuthDispatchContext } from '../context/contexts'
import { authService, type ProfileData } from '../services/authService'

export const useAuthState = () => {
  const context = useContext(AuthStateContext)
  if (!context) {
    throw new Error('useAuthState must be used within AuthProvider')
  }
  return context
}

export const useAuthDispatch = () => {
  const context = useContext(AuthDispatchContext)
  if (!context) {
    throw new Error('useAuthDispatch must be used within AuthProvider')
  }
  return context
}

export const useAuth = () => {
  const state = useAuthState()
  const dispatch = useAuthDispatch()

  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'CLEAR_ERROR' })
      
      await authService.login(email, password)
      
      // Get user profile after login
      const profile = await authService.getProfile()
      dispatch({ type: 'SET_USER', payload: { email, profile } })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Login failed' })
      throw error
    }
  }

  const register = async (email: string, password: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'CLEAR_ERROR' })
      
      await authService.register(email, password)
      dispatch({ type: 'SET_LOADING', payload: false })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Registration failed' })
      throw error
    }
  }

  const logout = () => {
    authService.clearToken()
    dispatch({ type: 'LOGOUT' })
  }

  const updateProfile = async (profileData: Partial<ProfileData>) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'CLEAR_ERROR' })
      
      await authService.updateProfile(profileData)
      
      // Refresh profile data
      const updatedProfile = await authService.getProfile()
      dispatch({ type: 'SET_USER', payload: { 
        email: state.user?.email || updatedProfile.email, 
        profile: updatedProfile 
      } })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Profile update failed' })
      throw error
    }
  }

  return {
    ...state,
    login,
    register,
    logout,
    updateProfile
  }
}
