import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Playground from './pages/Playground';
import Runs from './pages/Runs';
import Queue from './pages/Queue';
import Metrics from './pages/Metrics';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Playground />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/metrics" element={<Metrics />} />
      </Routes>
    </Layout>
  );
}

export default App;
