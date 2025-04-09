import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./Login";
import "./App.css";

function App() {
    return (
        <Router>
            <div className="app-container">
                <Routes>
                    <Route path="/" element={<Login />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
