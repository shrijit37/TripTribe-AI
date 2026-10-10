import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Hero from "./pages/Hero.jsx"
import Search from "./pages/Search.jsx"
import NotFound from "./pages/NotFound.jsx";
import  Result  from "./pages/Result.jsx";
import {Provider} from "react-redux"
import  store  from "../Redux/store.js";
import Footer from "./components/Footer.jsx";
import { AuthProvider } from "./context/AuthProvider.jsx";
function App() {
  return (
    <>
      <Provider store={store}>
        <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Hero />} />
            <Route path="/search" element={<Search />} />
            <Route path="*" element={<NotFound />} />
            <Route path = '/result' element={<Result />} />
          </Routes>
          <Footer />
        </BrowserRouter>
        </AuthProvider>
        </Provider>
    </>
  );
}

export default App;