import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Playground from './pages/Playground';
import Runs from './pages/Runs';
import Queue from './pages/Queue';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Playground />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/queue" element={<Queue />} />
      </Routes>
    </Layout>
  );
}

export default App;
