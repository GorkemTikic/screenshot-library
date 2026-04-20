import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ThemeProvider } from './contexts/ThemeContext';
import { DataProvider } from './contexts/DataContext';
import { RequestModalProvider } from './contexts/RequestModalContext';
import { HomePage } from './pages/HomePage';
import { AdminPage } from './pages/AdminPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <RequestModalProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </RequestModalProvider>
      </DataProvider>
    </ThemeProvider>
  );
}

export default App;
