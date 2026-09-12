import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ThemeProvider } from './contexts/ThemeContext';
import { DataProvider } from './contexts/DataContext';
import { AuthProvider } from './contexts/AuthContext';
import { RequestModalProvider } from './contexts/RequestModalContext';
import { SurveyModalProvider } from './contexts/SurveyModalContext';
import { HomePage } from './pages/HomePage';
import { AdminPage } from './pages/AdminPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { OwnersPage } from './pages/OwnersPage';

function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <AuthProvider>
          <RequestModalProvider>
            <SurveyModalProvider>
              <HashRouter>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<HomePage />} />
                    <Route path="admin" element={<AdminPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="owners" element={<OwnersPage />} />
                  </Route>
                </Routes>
              </HashRouter>
            </SurveyModalProvider>
          </RequestModalProvider>
        </AuthProvider>
      </DataProvider>
    </ThemeProvider>
  );
}

export default App;
