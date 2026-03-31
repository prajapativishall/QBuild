import React, { useState } from "react";
import { login } from "../services/authService";
import { useNavigate } from "react-router-dom";
import API from '../services/api'; 
// OR if you just meant to use axios directly:
import axios from 'axios';

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
const handleLogin = async () => {
  try {
    const res = await API.post("/auth/login", {
  email,
  password
});

localStorage.setItem("token", res.data.token);
navigate("/dashboard");
  } catch {
    alert("Login failed");
  }
};
  return (
  <div style={{ textAlign: "center", marginTop: "100px" }}>
    <h1>Login</h1>

    {/* Email */}
    <input
      type="email"
      placeholder="Enter Email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />

    <br /><br />

    {/* Password */}
    <input
      type="password"
      placeholder="Enter Password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
    />

    <br /><br />

    <button onClick={handleLogin}>Login</button>
  </div>
);
}

export default Login;
