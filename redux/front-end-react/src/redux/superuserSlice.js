import { createSlice } from '@reduxjs/toolkit';

const superuserSlice = createSlice({
  name: 'superuser',
  initialState: {
    deliveries: { search: '', typeFilter: '', statusFilter: '' },
    trips: { search: '', statusFilter: '' },
    vehicles: { search: '', filter: 'all', typeFilter: '' },
    maintenance: { search: '', priorityFilter: '', statusFilter: '' },
    users: { search: '', role: '', statusFilter: '', sortField: 'id', sortDir: 'asc', page: 1 },
    approvals: { search: '', role: 'all' },
    documents: { search: '', typeFilter: '', statusFilter: '', page: 1 },
    transactions: {
      invoiceSearch: '', txnSearch: '', invoiceClientFilter: '', invoiceStatusFilter: '',
      txnClientFilter: '', txnModeFilter: '', txnStatusFilter: '', invoicePage: 1, txnPage: 1,
    },
  },
  reducers: {
    setFilter(state, { payload: { page, field, value } }) {
      if (state[page] && Object.hasOwn(state[page], field)) {
        state[page][field] = value;
        if (page === 'users' && ['search', 'role', 'statusFilter'].includes(field)) state.users.page = 1;
        if (page === 'documents' && field !== 'page') state.documents.page = 1;
        if (page === 'transactions' && field !== 'invoicePage' && field.startsWith('invoice')) state.transactions.invoicePage = 1;
        if (page === 'transactions' && field !== 'txnPage' && field.startsWith('txn')) state.transactions.txnPage = 1;
      }
    },
  },
});

export const { setFilter } = superuserSlice.actions;
export default superuserSlice.reducer;
