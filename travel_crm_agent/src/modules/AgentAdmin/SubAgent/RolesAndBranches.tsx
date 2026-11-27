import { Navigate } from "react-router-dom";

/** Old /team/roles URL — team members and roles are now one screen. */
const RolesAndBranches = () => <Navigate to="/sub_agent" replace />;

export default RolesAndBranches;
