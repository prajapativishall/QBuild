import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const useAuthHook = () => {
  const { login, logout, user, loading, error, isAuthenticated } = useAuth();
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    return await login(loginData);
  };

  const handleLogout = () => {
    logout();
    setLoginData({ email: '', password: '' });
  };

  return {
    loginData,
    handleInputChange,
    handleLogin,
    handleLogout,
    user,
    loading,
    error,
    isAuthenticated,
  };
};

export default useAuthHook;
