import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Problem from './pages/Problem';
import CreateProblem from './pages/CreateProblem';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
            <Navbar />
            <Routes>
              <Route path="/"                element={<Home />}          />
              <Route path="/problems/:slug"  element={<Problem />}       />
              <Route path="/create-problem"  element={<CreateProblem />} />
              <Route path="/login"           element={<Login />}         />
              <Route path="/register"        element={<Register />}      />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
