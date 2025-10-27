import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, AppBar, Toolbar, Typography, Button } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import TeamsPage from './pages/TeamsPage';
import SprintsPage from './pages/SprintsPage';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const isTeamsPage = location.pathname === '/teams';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Sprint Insights
          </Typography>
          {!isTeamsPage && (
            <Button
              color="inherit"
              startIcon={<SettingsIcon />}
              onClick={() => navigate('/teams')}
            >
              Manage Teams
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/sprints" replace />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/sprints" element={<SprintsPage />} />
        </Routes>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App;
