const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const db = require("./config/db");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());
app.use(cors());

// Add error handling middleware
app.use((req, res, next) => {
  res.header("Content-Type", "application/json");
  next();
});

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const query = "INSERT INTO users (email, password, role) VALUES (?, ?, ?)";

  db.query(query, [email, hashedPassword, "user"], (err) => {
    if (err) {
      return res.status(500).json({ message: "User already exists" });
    }

    res.json({ message: "User Registered Successfully ✅" });
  });
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const query = "SELECT * FROM users WHERE email = ?";

  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });

    if (results.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = results[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      "SECRET_KEY",
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login Successful",
      token
    });
  });
});

app.listen(3001, () => {
  console.log("Auth Service running");
});
