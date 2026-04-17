import { Outlet } from "react-router-dom";
import Layout from "./components/layout/Layout";
import { useTaskReminders } from "./hooks/useTaskReminders";

export default function App() {
  useTaskReminders();

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
