import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Chat from './pages/Chat';
import Playground from './pages/Playground';
import Runs from './pages/Runs';
import Queue from './pages/Queue';
import Metrics from './pages/Metrics';
import Login from './pages/Login';
import { useAuth } from './hooks/useAuth';

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/metrics" element={<Metrics />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}

export default App;
