import { jwtDecode } from "jwt-decode";
import React from "react";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children, role }) {
  const token = localStorage.getItem("token");

  if (!token) return <Navigate to="/" />;

  const user = jwtDecode(token);

  if (role && user.role !== role) {
    return <Navigate to="/dashboard" />;
  }

  return children;
}

export default ProtectedRoute;
