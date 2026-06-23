import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { authService } from '../services/api';
import { AuthContext } from './authContextDef';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 > Date.now()) {
          setUser(decoded);
        } else {
          localStorage.clear();
        }
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const { data } = await authService.login({ username, password });
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    const decoded = jwtDecode(data.access);
    setUser(decoded);
    return decoded;
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  const can = (permission) => {
    if (!user) return false;
    const roles = user.roles || [];
    return roles.includes('root') || roles.includes(permission);
  };

  const haveAnyPermission = (permissions) => {
    if (!user) return false;
    const roles = user.roles || [];
    return roles.includes('root') || permissions.some((p) => roles.includes(p));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, haveAnyPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

