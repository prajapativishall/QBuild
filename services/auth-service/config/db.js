const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: "mysql-service",   // or qbuild-mysql (check your service name)
  user: "root",
  password: "root",
  database: "qbuild_db"
});

module.exports = db;