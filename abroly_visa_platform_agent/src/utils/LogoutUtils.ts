import { persistor } from "@/redux/store";


export const handleLogout = (navigate:any) => {
    localStorage.clear()
    persistor.purge()
    navigate("/")
    window.location.reload();
}