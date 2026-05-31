# QRating Web Admin Dashboard

A comprehensive React.js admin dashboard for the QRating construction inspection system.

## Features

- **Authentication**: JWT-based login system
- **Dashboard**: Overview with statistics and metrics
- **Projects**: CRUD operations for project management
- **Stages**: Manage inspection stages and ordering
- **Sections**: Organize questions within stages
- **Questions**: Primary/Secondary question logic with YES/NO/NA responses
- **Inspections**: Track and monitor inspection activities
- **Score Dashboard**: Spider chart visualization using Recharts
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## Tech Stack

- **React 18** with Vite
- **React Router** for navigation
- **Axios** for API calls
- **Recharts** for data visualization
- **Tailwind CSS** for styling
- **Lucide React** for icons

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:3000/api
```

## Project Structure

```
src/
  api/
    axios.js              # Axios configuration with auth
  components/
    Layout.jsx            # Main layout wrapper
    Sidebar.jsx           # Navigation sidebar
    Header.jsx            # Top header with search
    ProjectCard.jsx       # Project display card
    ProjectForm.jsx       # Project creation/edit form
    SectionForm.jsx       # Section creation/edit form
    QuestionForm.jsx      # Question creation/edit form
    SpiderChart.jsx       # Recharts spider chart component
  context/
    AuthContext.jsx       # Authentication context
  hooks/
    useAuth.js            # Authentication hook
  pages/
    Login.jsx             # Login page
    Dashboard.jsx         # Main dashboard with stats
    Projects.jsx          # Projects management
    ProjectDetails.jsx    # Detailed project view
    Stages.jsx            # Stages management
    Sections.jsx          # Sections management
    Questions.jsx         # Questions with primary/secondary logic
    Inspections.jsx       # Inspection tracking
    ScoreDashboard.jsx    # Score visualization with spider charts
  routes/
    AppRoutes.jsx         # Route configuration
  App.jsx                # Main app component
  main.jsx               # App entry point
  index.css              # Tailwind CSS styles
```

## API Integration

The dashboard is configured to work with the QRating backend API:

- **Base URL**: `http://localhost:3000/api`
- **Authentication**: JWT tokens stored in localStorage
- **Auto-redirect**: Automatic redirect to login on 401 errors

## Key Features

### Authentication
- JWT-based login system
- Automatic token management
- Protected routes
- User context and hooks

### Dashboard
- Real-time statistics
- Recent inspections
- System status
- Performance metrics

### Project Management
- Create, edit, delete projects
- Assign engineers
- Track progress
- View project details

### Question System
- Primary questions (always asked)
- Secondary questions (linked to primary)
- YES/NO/NA response logic
- Section and stage organization

### Score Visualization
- Spider charts for stage performance
- Master spider chart for overall view
- Interactive data visualization
- Score breakdown tables

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Styling

The project uses Tailwind CSS with custom utility classes:

- `.btn-primary` - Primary button style
- `.btn-secondary` - Secondary button style
- `.card` - Card container style
- `.input-field` - Form input style

### Components

All components are modular and reusable:

- **Layout Components**: Layout, Sidebar, Header
- **Form Components**: ProjectForm, SectionForm, QuestionForm
- **Display Components**: ProjectCard, SpiderChart, Table
- **Page Components**: Individual page components

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Deploy the `dist` folder to your web server

3. Configure environment variables for production

## Backend Integration

The dashboard expects the following API endpoints:

- `POST /api/auth/login` - Authentication
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/stages` - List stages
- `GET /api/sections` - List sections
- `GET /api/questions` - List questions
- `GET /api/inspections` - List inspections
- `GET /api/spider-chart/:inspectionId` - Spider chart data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the QRating construction inspection system.
