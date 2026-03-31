import Layout from "../components/layout/Layout";
import React from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

function Dashboard() {
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  let user = {};
  if (token) {
    user = jwtDecode(token);
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
     <Layout>
	 <h1>Dashboard</h1>

      <h2>Welcome, {user.email}</h2>
	<h3>Role: {user.role}</h3>

	{user.role === "admin" && (
  	<button>Admin Panel</button>
	)}
	</Layout>
<div style={{ display: "flex", gap: "20px" }}>
  <div style={{ background: "#e2e8f0", padding: "20px" }}>
    <h3>Total Audits</h3>
    <p>10</p>
  </div>

  <div style={{ background: "#e2e8f0", padding: "20px" }}>
    <h3>Completed</h3>
    <p>5</p>
  </div>
</div>

      <p>User ID: {user.id}</p>

      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default Dashboard;
