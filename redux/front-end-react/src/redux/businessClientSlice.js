import { createSlice } from '@reduxjs/toolkit';

const businessClientSlice = createSlice({
  name: 'businessClient',
  initialState: {
    active: { search: '', driverFilter: '', deliveryStatusFilter: '' },
    completed: { search: '', page: 1 },
    transactions: { search: '', tab: 'invoices', statusFilter: '' },
  },
  reducers: {
    setActiveFilters(state, action) { Object.assign(state.active, action.payload); },
    setCompletedSearch(state, action) { state.completed.search = action.payload; state.completed.page = 1; },
    setCompletedPage(state, action) { state.completed.page = Math.max(1, action.payload); },
    setTransactionFilters(state, action) { Object.assign(state.transactions, action.payload); },
  },
});

export const { setActiveFilters, setCompletedSearch, setCompletedPage, setTransactionFilters } = businessClientSlice.actions;
export default businessClientSlice.reducer;
