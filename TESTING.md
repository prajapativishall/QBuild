# Testing Guide for QRating Project

This document provides comprehensive information about testing the QRating project, including both backend and frontend testing setups.

## Table of Contents

- [Backend Testing](#backend-testing)
- [Frontend Testing](#frontend-testing)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)

## Backend Testing

### Setup

The backend uses **Jest** as the testing framework along with **Supertest** for API testing.

#### Dependencies

```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  }
}
```

#### Configuration

Jest configuration is in `backend/jest.config.js`:

```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',
    '!src/config/db.js',
    '!src/**/*.test.js'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000
};
```

#### Test Setup

The test setup file is `backend/tests/setup.js`:

```javascript
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = '';
process.env.DB_NAME = 'qrating_test';
```

### Running Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Sample Backend Tests

#### Auth API Tests (`backend/tests/auth.test.js`)

```javascript
const request = require('supertest');
const db = require('../src/config/db');

jest.mock('../src/config/db');

describe('Auth API', () => {
  it('should login with valid credentials', async () => {
    db.execute = jest.fn().mockResolvedValue([
      [{ id: 1, name: 'Test User', email: 'test@example.com', role: 'admin' }]
    ]);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

#### Project API Tests (`backend/tests/project.test.js`)

```javascript
describe('Project API', () => {
  it('should get all projects', async () => {
    db.execute = jest.fn().mockResolvedValue([
      [{ id: 1, project_name: 'Test Project', status: 'active' }]
    ]);

    const response = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });
});
```

## Frontend Testing

### Setup

The frontend uses **Vitest** as the testing framework along with **React Testing Library** for component testing.

#### Dependencies

```json
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/react": "^14.1.2",
    "@testing-library/user-event": "^14.5.1",
    "@vitest/ui": "^1.1.0",
    "jsdom": "^23.0.1",
    "vitest": "^1.1.0"
  }
}
```

#### Configuration

Vitest configuration is in `QRating-Web/vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.config.js',
        '**/*.test.js',
        '**/*.test.jsx'
      ]
    }
  }
});
```

#### Test Setup

The test setup file is `QRating-Web/src/tests/setup.js`:

```javascript
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;
```

### Running Frontend Tests

```bash
cd QRating-Web

# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Sample Frontend Tests

#### Dashboard Component Tests (`src/tests/Dashboard.test.jsx`)

```javascript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

vi.mock('../services/api', () => ({
  projectApi: {
    getAll: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));

describe('Dashboard Component', () => {
  it('renders dashboard title', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
```

#### SpiderChart Component Tests (`src/tests/SpiderChart.test.jsx`)

```javascript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SpiderChart from '../components/SpiderChart';

describe('SpiderChart Component', () => {
  const mockData = [
    { name: 'Domain 1', value: 8 },
    { name: 'Domain 2', value: 6 },
  ];

  it('renders spider chart with data', () => {
    render(<SpiderChart data={mockData} />);
    expect(screen.getByText('Spider Chart')).toBeInTheDocument();
  });
});
```

## Running Tests

### Backend

```bash
cd backend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

### Frontend

```bash
cd QRating-Web
npm test              # Run all tests
npm run test:ui       # UI mode
npm run test:coverage # With coverage report
```

## Writing Tests

### Backend Test Structure

```
backend/
├── tests/
│   ├── setup.js           # Test configuration
│   ├── auth.test.js       # Auth API tests
│   ├── project.test.js    # Project API tests
│   └── ...
```

### Frontend Test Structure

```
QRating-Web/
├── src/
│   ├── tests/
│   │   ├── setup.js           # Test configuration
│   │   ├── Dashboard.test.jsx # Dashboard component tests
│   │   ├── SpiderChart.test.jsx # SpiderChart component tests
│   │   └── ...
```

## Best Practices

### Backend Testing

1. **Mock Database Calls**: Always mock database calls to avoid hitting the actual database during tests
2. **Test All Endpoints**: Ensure all API endpoints have corresponding tests
3. **Test Authentication**: Test both authenticated and unauthenticated access
4. **Test Error Cases**: Include tests for error scenarios (404, 401, 400, etc.)
5. **Use Descriptive Test Names**: Make test names clear and descriptive

### Frontend Testing

1. **Test User Interactions**: Use `@testing-library/user-event` for simulating user actions
2. **Mock API Calls**: Mock external API calls to avoid network requests
3. **Test Component States**: Test different states (loading, error, success)
4. **Test Accessibility**: Ensure components are accessible
5. **Avoid Implementation Details**: Test behavior, not implementation

### General Best Practices

1. **Keep Tests Independent**: Each test should be independent and can run in isolation
2. **Use Before/After Hooks**: Use `beforeEach`, `afterEach`, `beforeAll`, `afterAll` for setup/teardown
3. **Write Maintainable Tests**: Keep tests simple and easy to understand
4. **Aim for High Coverage**: Strive for good test coverage, but don't sacrifice quality for coverage numbers
5. **Run Tests Frequently**: Run tests frequently during development to catch issues early

## Coverage Reports

### Backend Coverage

```bash
cd backend
npm run test:coverage
```

Coverage reports will be generated in the `backend/coverage` directory.

### Frontend Coverage

```bash
cd QRating-Web
npm run test:coverage
```

Coverage reports will be generated in the `QRating-Web/coverage` directory.

## Continuous Integration

To integrate tests with CI/CD pipelines:

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd backend && npm install
      - name: Run tests
        run: cd backend && npm test

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd QRating-Web && npm install
      - name: Run tests
        run: cd QRating-Web && npm test
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**: Ensure test database is configured in `tests/setup.js`
2. **Mock Not Working**: Check that mocks are defined before importing the module
3. **Timeout Errors**: Increase test timeout in jest.config.js if needed
4. **Import Errors**: Ensure all test dependencies are installed

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/guide/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
