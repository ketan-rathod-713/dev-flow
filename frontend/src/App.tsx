import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FlowsPage from './pages/FlowsPage';
import FlowDetailPage from './pages/FlowDetailPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<FlowsPage />} />
        <Route path="/flow/:flowName" element={<FlowDetailPage />} />
      </Routes>
    </Router>
  );
}

export default App;
