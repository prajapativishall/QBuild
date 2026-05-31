const bcrypt = require('bcryptjs');

// Simple in-memory user store for demo
// In production, this would be a database model
const users = [
  {
    id: 1,
    email: 'admin@qrating.com',
    password: '$2a$10$abcdefghijklmnopqrstuvwxz.1234567890', // 'admin123' hashed
    name: 'Admin User',
    role: 'admin'
  },
  {
    id: 2,
    email: 'reviewer@qrating.com',
    password: '$2a$10$abcdefghijklmnopqrstuvwxz.1234567890', // 'admin123' hashed
    name: 'Reviewer User',
    role: 'reviewer'
  }
];

class User {
  static async findOne({ where }) {
    if (where.email) {
      return users.find(user => user.email === where.email);
    }
    return null;
  }

  static async findById(id) {
    return users.find(user => user.id === id);
  }

  static async create(userData) {
    const newUser = {
      id: users.length + 1,
      email: userData.email,
      name: userData.name,
      role: userData.role || 'user'
    };
    users.push(newUser);
    return newUser;
  }
}

module.exports = User;
