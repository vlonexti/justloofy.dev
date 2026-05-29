import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import News from './pages/News';
import Store from './pages/Store';
import Staff from './pages/Staff';
import Apply from './pages/Apply';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Map from './pages/Map';

function App() {
  return (
    <Router>
      <div className="bg-[#222] min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/news" element={<News />} />
            <Route path="/store" element={<Store />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/map" element={<Map />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
