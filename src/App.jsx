import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ThemeProvider } from './contexts/ThemeContext';
import { DataProvider } from './contexts/DataContext';
import { HomePage } from './pages/HomePage';
import { AdminPage } from './pages/AdminPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </DataProvider>
    </ThemeProvider>
  );
}

export default App;
