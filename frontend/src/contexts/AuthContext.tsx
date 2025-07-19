import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, AuthTokens, AuthState } from '../types/auth';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; tokens: AuthTokens } }
  | { type: 'LOGIN_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        tokens: action.payload.tokens,
        isAuthenticated: true,
        isLoading: false
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Проверка токена при загрузке
  useEffect(() => {
    const initAuth = async () => {
      const storedTokens = localStorage.getItem('tokens');
      if (storedTokens) {
        try {
          const tokens = JSON.parse(storedTokens);
          api.defaults.headers.Authorization = `Bearer ${tokens.accessToken}`;
          
          // Проверяем токен запросом профиля
          const response = await api.get('/auth/profile');
          if (response.data.success) {
            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: {
                user: response.data.data.user,
                tokens
              }
            });
          } else {
            localStorage.removeItem('tokens');
            dispatch({ type: 'LOGIN_FAILURE' });
          }
        } catch (error) {
          localStorage.removeItem('tokens');
          dispatch({ type: 'LOGIN_FAILURE' });
        }
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.success) {
        const { user, tokens } = response.data.data;
        
        // Сохраняем токены
        localStorage.setItem('tokens', JSON.stringify(tokens));
        api.defaults.headers.Authorization = `Bearer ${tokens.accessToken}`;
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, tokens }
        });
        
        toast.success('Successfully logged in!');
        return true;
      } else {
        dispatch({ type: 'LOGIN_FAILURE' });
        toast.error(response.data.error || 'Login failed');
        return false;
      }
    } catch (error: any) {
      dispatch({ type: 'LOGIN_FAILURE' });
      toast.error(error.response?.data?.error || 'Login failed');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('tokens');
    delete api.defaults.headers.Authorization;
    dispatch({ type: 'LOGOUT' });
    toast.success('Logged out successfully');
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const storedTokens = localStorage.getItem('tokens');
      if (!storedTokens) return false;

      const tokens = JSON.parse(storedTokens);
      const response = await api.post('/auth/refresh-token', {
        refreshToken: tokens.refreshToken
      });

      if (response.data.success) {
        const newTokens = response.data.data.tokens;
        localStorage.setItem('tokens', JSON.stringify(newTokens));
        api.defaults.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return true;
      }
      return false;
    } catch (error) {
      logout();
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 