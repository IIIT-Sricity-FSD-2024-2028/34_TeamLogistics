import { createSlice } from '@reduxjs/toolkit';

const driverSlice = createSlice({
  name: 'driver',
  initialState: {
    dashboard: { search: '', statusFilter: '' },
    history: { search: '', page: 1 },
  },
  reducers: {
    setDashboardSearch(state, action) { state.dashboard.search = action.payload; },
    setDashboardStatusFilter(state, action) { state.dashboard.statusFilter = action.payload; },
    setHistorySearch(state, action) { state.history.search = action.payload; state.history.page = 1; },
    setHistoryPage(state, action) { state.history.page = Math.max(1, action.payload); },
  },
});

export const { setDashboardSearch, setDashboardStatusFilter, setHistorySearch, setHistoryPage } = driverSlice.actions;
export default driverSlice.reducer;
