import { useState } from "react";

import Login from "./pages/login";
import Dashboard from "./pages/Dashboard";
import ManagerDashboard from "./pages/ManagerDashboard";

import type { AuthUser } from "./types/auth";

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);

  const handleLogout = () => {
    localStorage.removeItem("collectiq_token");
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  if (user.role === "branch_manager") {
    return (
      <ManagerDashboard
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
    />
  );
}

export default App;