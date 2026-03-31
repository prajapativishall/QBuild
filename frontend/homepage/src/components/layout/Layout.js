import React from "react";

function Layout({ children }) {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      
      {/* Sidebar */}
      <div style={{
  width: "250px",
  background: "#0f172a",
  color: "white",
  padding: "20px"
}}>
  <h2>QBuild</h2>
  <hr />
  <p>📊 Dashboard</p>
  <p>📝 Audits</p>
  <p>👤 Users</p>
</div>

      {/* Content */}
      <div style={{ flex: 1, padding: "20px" }}>
        {children}
      </div>

    </div>
  );
}

export default Layout;
