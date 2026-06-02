import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import useAuthHook from '../hooks/useAuth';
import '../styles/Login.css';

const Login = () => {
  const { loginData, handleInputChange, handleLogin, loading, error } = useAuthHook();
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await handleLogin(e);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="login-page">

      <div className="login-card">

        {/* Logo */}
        <div className="login-header">

          <img
            src="/logo.png"
            alt="Company Logo"
            className="login-logo"
          />

          <h2 className="login-title">
            Sign in to QBuild
          </h2>

          <p className="login-subtitle">
            Enter your credentials below
          </p>

        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">

          {/* Email */}
          <div className="form-group">

            <label>Email address</label>

            <input
              type="email"
              name="email"
              placeholder="Enter Your Email"
              value={loginData.email}
              onChange={handleInputChange}
              required
            />

          </div>

          {/* Password */}
          <div className="form-group">

            <label>Password</label>

            <div className="password-wrapper">

              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Enter your password"
                value={loginData.password}
                onChange={handleInputChange}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>

            </div>

          </div>

          {/* Error */}
          {error && (
            <div className="login-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Button */}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >

            {loading ? (
              <span className="spinner"></span>
            ) : (
              "Sign in"
            )}

          </button>

        </form>

      </div>

    </div>
  );
};

export default Login;