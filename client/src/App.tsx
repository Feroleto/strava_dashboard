import { Route, Routes } from 'react-router-dom';
import Dashboard from './Dashboard';
import ActivityDetail from './ActivityDetail';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/activities/:id" element={<ActivityDetail />} />
    </Routes>
  );
}

export default App;
