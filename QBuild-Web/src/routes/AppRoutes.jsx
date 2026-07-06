import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthProvider } from '../context/AuthContext';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Layout from '../components/Layout';
import Projects from '../pages/Projects';
import ProjectDetails from '../pages/ProjectDetails';
import Inspections from '../pages/Inspections';
import Domains from '../pages/Domains';
import SubDomains from '../pages/SubDomains';
import Queries from '../pages/Queries';
import ScoreDashboard from '../pages/ScoreDashboard';
import Reports from '../pages/Reports';
import UserManagement from '../pages/UserManagement';
import ReviewerDashboard from '../pages/ReviewerDashboard';
import ReviewerInspectionReview from '../pages/ReviewerInspectionReview';
import ManagerDashboard from '../pages/ManagerDashboard';
import ManagerInspectionReview from '../pages/ManagerInspectionReview';
import MobileDashboard from '../pages/MobileDashboard';
import MobileChecklistAccept from '../pages/MobileChecklistAccept';
import MobileInspection from '../pages/MobileInspection';

const AppRoutesContent = () => {
  const { isAuthenticated, loading, isReviewer, isManager, isViewer, isAdmin } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '2px solid rgb(229, 231, 235)',
          borderTop: '2px solid rgb(59, 130, 246)',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }

  const getDefaultRoute = () => {
    if (isReviewer) return '/reviewer-dashboard';
    if (isManager) return '/manager-dashboard';
    if (isViewer) return '/dashboard';
    return '/dashboard';
  };

  return (
    <Routes>
      <Route 
        path="/login" 
        element={!isAuthenticated ? <Login /> : <Navigate to={getDefaultRoute()} replace />} 
      />
      
      <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
      
      {/* Protected Routes */}
      <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="dashboard" element={!isAuthenticated ? <Navigate to="/login" replace /> : <Dashboard />} />
        <Route path="projects" element={isViewer || isReviewer ? <Navigate to={getDefaultRoute()} replace /> : <Projects />} />
        <Route path="projects/:id" element={isViewer || isReviewer ? <Navigate to={getDefaultRoute()} replace /> : <ProjectDetails />} />
        <Route path="projects/:id/inspections" element={isViewer || isReviewer ? <Navigate to={getDefaultRoute()} replace /> : <Inspections />} />
        <Route path="domains" element={isViewer ? <Navigate to={getDefaultRoute()} replace /> : <Domains />} />
        <Route path="sub-domains" element={isViewer ? <Navigate to={getDefaultRoute()} replace /> : <SubDomains />} />
        <Route path="queries" element={isViewer ? <Navigate to={getDefaultRoute()} replace /> : <Queries />} />
        <Route path="reports" element={isViewer || isReviewer || isManager ? <Navigate to={getDefaultRoute()} replace /> : <Reports />} />
        <Route path="score-dashboard" element={isViewer || isReviewer || isManager ? <Navigate to={getDefaultRoute()} replace /> : <ScoreDashboard />} />
        <Route path="users" element={isViewer || isReviewer || isManager ? <Navigate to={getDefaultRoute()} replace /> : <UserManagement />} />
        <Route path="reviewer-dashboard" element={isManager || isViewer ? <Navigate to={getDefaultRoute()} replace /> : <ReviewerDashboard />} />
        <Route path="reviewer-dashboard/review/:inspectionId" element={isManager || isViewer ? <Navigate to={getDefaultRoute()} replace /> : <ReviewerInspectionReview />} />
        <Route path="manager-dashboard" element={isManager || isAdmin ? <ManagerDashboard /> : <Navigate to={getDefaultRoute()} replace />} />
        <Route path="manager-dashboard/review/:inspectionId" element={isManager || isAdmin ? <ManagerInspectionReview /> : <Navigate to={getDefaultRoute()} replace />} />
      </Route>

      {/* Mobile Routes (no Layout wrapper) */}
      <Route path="/mobile-dashboard" element={isAuthenticated ? <MobileDashboard /> : <Navigate to="/login" replace />} />
      <Route path="/mobile-checklist-list" element={isAuthenticated ? <MobileDashboard /> : <Navigate to="/login" replace />} />
      <Route path="/mobile-checklist/:inspectionId" element={isAuthenticated ? <MobileChecklistAccept /> : <Navigate to="/login" replace />} />
      <Route path="/mobile-inspection/:inspectionId" element={isAuthenticated ? <MobileInspection /> : <Navigate to="/login" replace />} />
      <Route path="/mobile-new-inspection/:projectId" element={isAuthenticated ? <MobileChecklistAccept /> : <Navigate to="/login" replace />} />
      
      {/* Fallback route */}
      <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
    </Routes>
  );
};

const AppRoutes = () => {
  return (
    <AuthProvider>
      <AppRoutesContent />
    </AuthProvider>
  );
};

export default AppRoutes;
