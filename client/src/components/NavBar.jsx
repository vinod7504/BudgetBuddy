import { Link, useNavigate } from "react-router-dom";
import { IoBook } from "react-icons/io5";

export default function NavBar() {
  const navigate = useNavigate();
  const loggedIn = !!localStorage.getItem("token");
  const name = localStorage.getItem("name");

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("name");
    localStorage.removeItem("email");
    navigate("/login");
  };

  return (
    <div className="nav container">
      <div>
        <Link to="/" style={{ fontWeight: 900, fontSize: 45 }}>
          <IoBook /> Budget Buddy
        </Link>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {loggedIn && (
          <>
            <Link to="/add">Add</Link>
            <Link to="/monthly">Monthly</Link>
            <span className="badge">{name || "User"}</span>
            <button onClick={logout}>Logout</button>
          </>
        )}
        {!loggedIn && (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </div>
  );
}
