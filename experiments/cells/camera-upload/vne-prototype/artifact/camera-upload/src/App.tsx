import { CConfigProvider } from '@cloud-materials/common';
import { HashRouter, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <CConfigProvider>
      <HashRouter>
        <Routes>
          <Route path="*" element={<HomePage />} />
        </Routes>
      </HashRouter>
    </CConfigProvider>
  );
}
