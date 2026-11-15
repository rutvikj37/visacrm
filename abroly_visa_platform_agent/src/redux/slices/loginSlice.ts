import { createSlice } from "@reduxjs/toolkit"


const initState = {
    isLoading: true,
    token: null,
    role_type: null,
    authLoading: null,
    profileimage: null,
    email: null,
    user_name: null,
    phone:null,
    designation:"",
    // SaaS plan / trial info from agent/kyc (refreshed on every app load)
    subscription: null as any,
    // owner | counsellor | branch_manager | accounts | documents
    team_role: null as string | null,
    // branch office of a team member (null for the owner / people without a branch)
    branch_id: null as number | null,
    // agency name / logo for the panel header (Branding settings)
    agency: null as { name: string | null; logo: string | null } | null
}


const loginSlice = createSlice({
    name: "login",
    initialState: initState,
    reducers: {
        setToken(state, action) {
            state.token = action.payload;
        },
        setRole(state, action) {
            state.role_type = action.payload;
        },
        setAuthLoading(state, action) {
            state.authLoading = action.payload;
        },
        setProfile(state, action) {
            state.profileimage = action.payload.profileimage;
            state.email = action.payload.email;
            state.user_name = action.payload.user_name;
            state.phone = action.payload.phone;
            state.designation = action.payload.designation;
        },
        setTeamRole(state, action) {
            state.team_role = action.payload || null;
        },
        setAgencyInfo(state, action) {
            state.agency = action.payload || null;
        },
        setBranchId(state, action) {
            state.branch_id = action.payload ? Number(action.payload) : null;
        },
        setSubscription(state, action) {
            state.subscription = action.payload || null;
        },
        clearUserInfo(state, action) {
            state.isLoading = true;
            state.token = null;
            state.role_type = null;
            state.authLoading = null;
            state.profileimage = null;
            state.email = null;
            state.user_name = null;
            state.phone = null;
            state.subscription = null;
        }

    }
})


// export const { fetchUserData } = userListSlice.actions;
// export default userListSlice.reducer;

export const { setToken, setRole, setAuthLoading, setProfile, setSubscription, setTeamRole, setBranchId, setAgencyInfo, clearUserInfo } = loginSlice.actions
export default loginSlice.reducer