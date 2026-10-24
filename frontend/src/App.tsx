import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/header/Header";
import ToastProvider from "./components/ui/toast/ToastProvider";
import About from "./page/About/About";
import Contact from "./page/Contact/Contact";
import Home from "./page/home/Home";

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Header />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
