import React from 'react';
import ReactDOM from 'react-dom/client';
// import './index.css'; // Removed this import as styling is handled by App.js
import App from './App';
// import reportWebVitals from './reportWebVitals'; // Removed as it's causing build issues and not essential for core functionality

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals(); // Removed the call as well
