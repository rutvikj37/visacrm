

import { clearSession } from "./product";

export const handleLogout = (navigate:any) => {
    clearSession()
    navigate("/")
    window.location.reload();
}