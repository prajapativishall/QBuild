# QBuild Backend API

A production-ready Node.js backend for quality rating and inspection management system built with Express.js, MySQL, and JWT authentication.

## Features

- **API-first Architecture** - RESTful API design with comprehensive documentation
- **Project-based RBAC** - Role-based access control with project-specific permissions
- **Global Admin Access** - System-wide administrative capabilities
- **Mobile-first Response System** - Optimized for mobile device interactions
- **Admin Override Capability** - Admins can override inspection responses
- **Yes/No Checklist System** - Structured inspection workflow with scoring
- **JWT Authentication** - Secure token-based authentication
- **MySQL with Connection Pooling** - Efficient database operations
- **Comprehensive Logging** - Detailed request and error logging
- **Security Hardening** - Multiple layers of security protection

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL with mysql2 driver
- **Authentication**: JWT with bcrypt password hashing
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Winston, Morgan
- **Validation**: Express Validator
- **Environment**: dotenv

## Prerequisites

- Node.js 16.0.0 or higher
- MySQL 8.0.0 or higher
- npm or yarn package manager

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd QBuild
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the environment template and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=qbuild
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
DB_ACQUIRE_TIMEOUT=60000
DB_TIMEOUT=60000

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
CORS_CREDENTIALS=true

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/app.log
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d
```

### 4. Database Setup

#### Create Database

```sql
CREATE DATABASE qbuild CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### Import Schema

```bash
mysql -u root -p qbuild < database/schema.sql
```

Or run the schema file directly in your MySQL client.

### 5. Start the Application

#### Development Mode

```bash
npm run dev
```

#### Production Mode

```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/users/register` - Register new user
- `POST /api/users/login` - User login
- `POST /api/users/refresh-token` - Refresh access token

### User Management

- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile
- `POST /api/users/change-password` - Change password

### Admin User Management

- `GET /api/users/admin/users` - Get all users (Admin only)
- `GET /api/users/admin/users/:userId` - Get user by ID (Admin only)
- `PUT /api/users/admin/users/:userId` - Update user (Admin only)
- `DELETE /api/users/admin/users/:userId` - Delete user (Admin only)

### Project Management

- `GET /api/projects` - Get all projects (with access filtering)
- `POST /api/projects` - Create new project
- `GET /api/projects/:projectId` - Get project by ID
- `PUT /api/projects/:projectId` - Update project
- `DELETE /api/projects/:projectId` - Delete project

### Project User Management

- `GET /api/projects/:projectId/users` - Get project users with roles
- `POST /api/projects/:projectId/users/assign` - Assign user to project
- `PUT /api/projects/:projectId/users/:assignmentId` - Update user role
- `DELETE /api/projects/:projectId/users/:assignmentId` - Remove user from project

### System Endpoints

- `GET /health` - Health check endpoint
- `GET /api` - API information and endpoints

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Role-Based Access Control (RBAC)

### Default Roles

1. **Global Admin** - Full system access
2. **Project Manager** - Can manage projects and assign roles
3. **Inspector** - Can conduct inspections
4. **Viewer** - Can view inspection results

### Permissions

- `create_project` - Create new projects
- `edit_project` - Edit project details
- `delete_project` - Delete projects
- `assign_roles` - Assign user roles to projects
- `create_inspection` - Create new inspections
- `edit_inspection` - Edit existing inspections
- `submit_inspection` - Submit inspections
- `override_responses` - Override inspection responses
- `view_reports` - View inspection reports
- `manage_users` - Manage system users

## Request/Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "errors": [] // Validation errors (if applicable)
}
```

### Pagination

List endpoints support pagination:

```
GET /api/projects?page=1&limit=20&search=keyword&sortBy=createdAt&sortOrder=desc
```

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `search` - Search term
- `sortBy` - Sort field
- `sortOrder` - Sort order: asc/desc

## Database Schema

The application uses the following main tables:

- `users` - User accounts and authentication
- `projects` - Project information
- `roles` - System roles
- `permissions` - System permissions
- `role_permissions` - Role-permission mapping
- `project_user_roles` - User-project-role assignments
- `stages` - Inspection stages
- `checklist_items` - Checklist items
- `inspections` - Inspection records
- `checklist_responses` - Inspection responses
- `response_overrides` - Admin overrides
- `stage_scores` - Stage-wise scores
- `final_scores` - Final inspection scores

## Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Request rate limiting
- **Input Validation** - Request validation and sanitization
- **Password Hashing** - bcrypt for secure password storage
- **JWT Tokens** - Secure authentication tokens
- **Request Logging** - Comprehensive request logging
- **Error Handling** - Secure error responses

## Logging

The application uses Winston for structured logging:

- **Development** - Console logging with colors
- **Production** - File logging with rotation
- **Log Levels** - error, warn, info, http, debug
- **Log Files** - Stored in `logs/` directory

## Error Handling

The API includes comprehensive error handling:

- **Validation Errors** - 400 Bad Request
- **Authentication Errors** - 401 Unauthorized
- **Authorization Errors** - 403 Forbidden
- **Not Found Errors** - 404 Not Found
- **Conflict Errors** - 409 Conflict
- **Server Errors** - 500 Internal Server Error

## Development

### Linting

```bash
npm run lint
```

### Fix Linting Issues

```bash
npm run lint:fix
```

### Testing

```bash
npm test
```

### Watch Mode Testing

```bash
npm run test:watch
```

## Production Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure production database
3. Set secure JWT secrets
4. Configure CORS origins
5. Set up proper logging

### Process Management

Use PM2 for production process management:

```bash
npm install -g pm2
pm2 start src/app.js --name "qbuild-api"
pm2 startup
pm2 save
```

### Database Optimization

- Use connection pooling (configured)
- Add appropriate indexes
- Monitor query performance
- Regular database maintenance

## Monitoring

### Health Checks

- `GET /health` - Application health status
- Database connectivity checks
- Memory and CPU monitoring

### Logs Monitoring

- Application logs in `logs/` directory
- Error tracking and alerting
- Performance metrics logging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

- Create an issue in the repository
- Check the API documentation at `/api`
- Review the logs for error details

## Changelog

### Version 1.0.0

- Initial release
- Basic CRUD operations for users and projects
- JWT authentication
- RBAC system
- Database schema
- Security middleware
- Logging system
- API documentation
