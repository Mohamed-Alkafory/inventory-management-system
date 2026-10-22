
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header/Header";
import About from "./components/About/about";
import Contact from "./components/Contact/contact";

export default function App() {
  return (
    <BrowserRouter>
      <Header />

      <Routes>
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </BrowserRouter>
  );
}
