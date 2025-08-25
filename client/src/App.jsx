// import { Routes, Route, Navigate } from "react-router-dom";
// // import NavBar from "./components/NavBar.jsx";
// import NavBar from "./components/NavBar.jsx";
// import ProtectedRoute from "./components/ProtectedRoute.jsx";
// import Register from "./pages/Register.jsx";
// import Login from "./pages/Login.jsx";
// import Home from "./pages/Home.jsx";
// import AddExpense from "./pages/AddExpense.jsx";
// import Monthly from "./pages/Monthly.jsx";

// export default function App() {
//   const loggedIn = !!localStorage.getItem("token");
//   return (
//     <>
//       <NavBar />
//       <div className="container">
//         <Routes>
//           <Route path="/register" element={<Register />} />
//           <Route path="/login" element={<Login />} />

//           <Route
//             path="/"
//             element={
//               <ProtectedRoute>
//                 <Home />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/add"
//             element={
//               <ProtectedRoute>
//                 <AddExpense />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/monthly"
//             element={
//               <ProtectedRoute>
//                 <Monthly />
//               </ProtectedRoute>
//             }
//           />

//           <Route
//             path="*"
//             element={<Navigate to={loggedIn ? "/" : "/login"} />}
//           />
//         </Routes>
//       </div>
//     </>
//   );
// }
import { Routes, Route, Navigate } from "react-router-dom";
import NavBar from "./components/NavBar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import AddExpense from "./pages/AddExpense.jsx";
import Monthly from "./pages/Monthly.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

export default function App() {
  const loggedIn = !!localStorage.getItem("token");

  return (
    <>
      <NavBar />
      <div className="container">
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset" element={<ResetPassword />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add"
            element={
              <ProtectedRoute>
                <AddExpense />
              </ProtectedRoute>
            }
          />
          <Route
            path="/monthly"
            element={
              <ProtectedRoute>
                <Monthly />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route
            path="*"
            element={<Navigate to={loggedIn ? "/" : "/login"} />}
          />
        </Routes>
      </div>
    </>
  );
}
