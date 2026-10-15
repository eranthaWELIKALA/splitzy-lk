import { lazy } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { RedirectIfAuthed, RequireAuth } from '@/components/layout/RequireAuth';
import { ThemeController } from '@/components/layout/ThemeController';
import { Toaster } from '@/components/ui/Toaster';
import { RouteError } from '@/components/RouteError';

// Route-level code splitting keeps the initial bundle small.
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const GroupsPage = lazy(() => import('@/pages/GroupsPage'));
const GroupDetailPage = lazy(() => import('@/pages/GroupDetailPage'));
const FriendsPage = lazy(() => import('@/pages/FriendsPage'));
const FriendDetailPage = lazy(() => import('@/pages/FriendDetailPage'));
const ExpenseDetailPage = lazy(() => import('@/pages/ExpenseDetailPage'));
const ActivityPage = lazy(() => import('@/pages/ActivityPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const SignupPage = lazy(() => import('@/pages/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));

// Hash routing: GitHub Pages serves static files only, so deep links must not hit the server.
const router = createHashRouter([
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <RedirectIfAuthed />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignupPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/reset-password', element: <ResetPasswordPage /> },
          {
            element: <AppShell />,
            children: [
              { index: true, path: '/', element: <DashboardPage /> },
              { path: '/groups', element: <GroupsPage /> },
              { path: '/groups/:groupId', element: <GroupDetailPage /> },
              { path: '/friends', element: <FriendsPage /> },
              { path: '/friends/:friendId', element: <FriendDetailPage /> },
              { path: '/expenses/:expenseId', element: <ExpenseDetailPage /> },
              { path: '/activity', element: <ActivityPage /> },
              { path: '/settings', element: <SettingsPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <>
      <ThemeController />
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
