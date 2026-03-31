const express = require("express");
const db = require("./config/db");

const app = express();
app.use(express.json());

// Create Audit
app.post("/audit", (req, res) => {
  const { title, status } = req.body;

  db.query(
    "INSERT INTO audits (title, status) VALUES (?, ?)",
    [title, status],
    (err) => {
      if (err) return res.status(500).send(err);
      res.json({ message: "Audit Created" });
    }
  );
});

// Get Audits
app.get("/audit", (req, res) => {
  db.query("SELECT * FROM audits", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

app.listen(3002, () => console.log("Audit Service Running"));
