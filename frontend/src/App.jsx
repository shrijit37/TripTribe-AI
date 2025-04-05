import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/navbar";
import Hero from "./pages/Hero.jsx"
import Search from "./pages/Search.jsx"
import NotFound from "./pages/NotFound.jsx";

import { AuthProvider } from "./context/AuthProvider.jsx";
import  Result  from "./pages/Result.jsx";
function App() {
  return (
    <>
      <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Hero />} />
            <Route path="/search" element={<Search />} />
            <Route path="*" element={<NotFound />} />
            <Route path = '/result' element={<Result />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </>
  );
}

export default App;
