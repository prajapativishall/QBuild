const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

// Enable JSON parsing
app.use(express.json());

// Add CORS headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Content-Type", "application/json");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Health check for /api
app.get("/api", (req, res) => {
  res.json({ message: "QBuild API Gateway Running 🚀" });
});

// Example proxy (future)
app.use("/api/auth", createProxyMiddleware({
  target: "http://auth-service:3001",
  changeOrigin: true,
  pathRewrite: {
    "^/api/auth": ""
  },
  onError: (err, req, res) => {
    console.error("Auth service error:", err.message);
    res.status(503).json({ message: "Auth service unavailable" });
  }
}));

app.use("/api/audit", createProxyMiddleware({
  target: "http://audit-service:3002",
  changeOrigin: true,
  pathRewrite: { "^/api/audit": "" },
  onError: (err, req, res) => {
    console.error("Audit service error:", err.message);
    res.status(503).json({ message: "Audit service unavailable" });
  }
}));

app.listen(3000, () => {
  console.log("API Gateway running on port 3000");
});
