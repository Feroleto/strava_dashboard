import { Route, Routes } from 'react-router-dom';
import ActivitiesList from './ActivitiesList';
import ActivityDetail from './ActivityDetail';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ActivitiesList />} />
      <Route path="/activities/:id" element={<ActivityDetail />} />
    </Routes>
  );
}

export default App;
