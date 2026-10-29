import './core/logger'; // Initialize console interceptors before anything else

// document.addEventListener('contextmenu', e => e.preventDefault());
import "./core/styles/globals.css";
import App from "./App";
import ReactDOM from "react-dom/client";
import { RouterProvider, createHashRouter } from "react-router-dom";
import { ToastProvider } from './components/UI/Toast';
import HomePage from './pages/Home';
import ClientPage from './pages/Client';
import ErrorBoundary from './components/Navigation/ErrorBoundry';

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true,              element: <HomePage /> },
      { path: "client",           element: <ClientPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ToastProvider>
    <RouterProvider router={router} />
  </ToastProvider>
);