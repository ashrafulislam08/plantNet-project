import { Helmet } from "react-helmet-async";
import AdminStatistics from "../../../components/Dashboard/Statistics/AdminStatistics";
import { Navigate } from "react-router-dom";
import useRole from "../../../hooks/useRole";
const Statistics = () => {
  const [role] = useRole();
  if (role === "customer") return <Navigate to="/dashboard/my-orders" />;
  if (role === "seller") return <Navigate to="/dashboard/my-inventory" />;
  return (
    <div>
      <Helmet>
        <title>Dashboard</title>
      </Helmet>
      <AdminStatistics />
    </div>
  );
};

export default Statistics;
