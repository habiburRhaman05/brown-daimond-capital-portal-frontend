import { Link, Route, Routes } from 'react-router-dom';
import { HomeRedirect, Protected } from './auth/Guards';
import { Layout } from './components/Layout';
import { AdminLogin, ClientLogin, Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { ForgotPassword } from './pages/ForgotPassword';
import { SetPassword } from './pages/SetPassword';
import { PrivacyPolicy, TermsOfUse } from './pages/Legal';
import { Dashboard } from './pages/client/Dashboard';
import { Information } from './pages/client/Information';
import { Website } from './pages/client/Website';
import { Requests } from './pages/client/Requests';
import { AdminHome } from './pages/admin/AdminHome';
import { Clients } from './pages/admin/Clients';
import { ClientDetail } from './pages/admin/ClientDetail';
import { AdminRequests } from './pages/admin/AdminRequests';
import { Invites } from './pages/admin/Invites';
import { Signups } from './pages/admin/Signups';
import { Account } from './pages/Account';

function NotFound() {
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That page does not exist.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">Go home</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/client/login" element={<ClientLogin />} />
      <Route path="/client/signup" element={<Signup />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfUse />} />
      <Route path="/" element={<HomeRedirect />} />

      {/* Client area */}
      <Route element={<Protected role="client"><Layout /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/information" element={<Information />} />
        <Route path="/dashboard/website" element={<Website />} />
        <Route path="/dashboard/requests" element={<Requests />} />
        <Route path="/dashboard/account" element={<Account />} />
      </Route>

      {/* Admin area */}
      <Route element={<Protected role="admin"><Layout /></Protected>}>
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/clients" element={<Clients />} />
        <Route path="/admin/clients/:id" element={<ClientDetail />} />
        <Route path="/admin/requests" element={<AdminRequests />} />
        <Route path="/admin/signups" element={<Signups />} />
        <Route path="/admin/invites" element={<Invites />} />
        <Route path="/admin/account" element={<Account />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
