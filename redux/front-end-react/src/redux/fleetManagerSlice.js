import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  vehicles: { search: '', typeFilter: '', statusFilter: '' },
  drivers: { search: '', statusFilter: '' },
  compliance: { search: '', overallFilter: '', licenseFilter: '' },
  trips: { search: '', driverFilter: '', vehicleFilter: '', statusFilter: '' },
  maintenance: { search: '', vehicleFilter: '', priorityFilter: '', statusFilter: '', mechanicFilter: '' },
  documents: { search: '', typeFilter: '', ownerTypeFilter: '', statusFilter: '', page: 1 },
  transactions: { month: '', search: '', tab: 'statement', partyFilter: '', statusFilter: '' },
};

const fleetManagerSlice = createSlice({
  name: 'fleetManager', initialState,
  reducers: {
    setFilter(state, { payload: { page, field, value } }) {
      if (!state[page] || !(field in state[page])) return;
      state[page][field] = value;
      if (field !== 'page' && 'page' in state[page]) state[page].page = 1;
    },
  },
});

export const { setFilter } = fleetManagerSlice.actions;
export default fleetManagerSlice.reducer;
