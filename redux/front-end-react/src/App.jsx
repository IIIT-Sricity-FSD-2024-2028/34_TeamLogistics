import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SessionProvider } from './auth/SessionContext';
import { ToastProvider } from './hooks/useToast';
import RequireRole from './auth/RequireRole';

import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import Home from './pages/public/Home';
import About from './pages/public/About';
import Roles from './pages/public/Roles';
import RegisterBusinessClient from './pages/public/RegisterBusinessClient';
import RegisterDriver from './pages/public/RegisterDriver';
import RegisterFleetManager from './pages/public/RegisterFleetManager';
import NotFound from './pages/public/NotFound';

import { lazy, Suspense } from 'react';
import { DriverNotifications, SuNotifications, FmNotifications, BcNotifications } from './components/NotificationInbox';

const DriverLayout = lazy(() => import('./layouts/DriverLayout'));
const DriverDashboard = lazy(() => import('./pages/driver/DriverDashboard'));
const DriverMap = lazy(() => import('./pages/driver/DriverMap'));
const DriverHistory = lazy(() => import('./pages/driver/DriverHistory'));
const DriverEarnings = lazy(() => import('./pages/driver/DriverEarnings'));
const DriverTaskDetails = lazy(() => import('./pages/driver/DriverTaskDetails'));
const DriverReportIssue = lazy(() => import('./pages/driver/DriverReportIssue'));
const DriverProofOfDelivery = lazy(() => import('./pages/driver/DriverProofOfDelivery'));
const DriverProfile = lazy(() => import('./pages/driver/DriverProfile'));
const DriverTasks = lazy(() => import('./pages/driver/DriverTasks'));
const DriverMessages = lazy(() => import('./pages/driver/DriverMessages'));

const SuperuserLayout = lazy(() => import('./layouts/SuperuserLayout'));
const SuDashboard = lazy(() => import('./pages/superuser/SuDashboard'));
const SuManageUsers = lazy(() => import('./pages/superuser/SuManageUsers'));
const SuUserForm = lazy(() => import('./pages/superuser/SuUserForm'));
const SuReports = lazy(() => import('./pages/superuser/SuReports'));
const SuRoles = lazy(() => import('./pages/superuser/SuRoles'));
const SuSystemConfiguration = lazy(() => import('./pages/superuser/SuSystemConfiguration'));
const SuDeliveryRequests = lazy(() => import('./pages/superuser/SuDeliveryRequests'));
const SuTripMonitoring = lazy(() => import('./pages/superuser/SuTripMonitoring'));
const SuVehicles = lazy(() => import('./pages/superuser/SuVehicles'));
const SuMaintenance = lazy(() => import('./pages/superuser/SuMaintenance'));
const SuScheduleMaintenance = lazy(() => import('./pages/superuser/SuScheduleMaintenance'));
const SuTransactions = lazy(() => import('./pages/superuser/SuTransactions'));
const SuDocuments = lazy(() => import('./pages/superuser/SuDocuments'));
const SuProfile = lazy(() => import('./pages/superuser/SuProfile'));
const SuApprovals = lazy(() => import('./pages/superuser/SuApprovals'));

const FleetManagerLayout = lazy(() => import('./layouts/FleetManagerLayout'));
const FmDashboard = lazy(() => import('./pages/fleet-manager/FmDashboard'));
const FmVehicles = lazy(() => import('./pages/fleet-manager/FmVehicles'));
const FmAddVehicle = lazy(() => import('./pages/fleet-manager/FmAddVehicle'));
const FmEditVehicle = lazy(() => import('./pages/fleet-manager/FmEditVehicle'));
const FmDrivers = lazy(() => import('./pages/fleet-manager/FmDrivers'));
const FmAddDriver = lazy(() => import('./pages/fleet-manager/FmAddDriver'));
const FmEditDriver = lazy(() => import('./pages/fleet-manager/FmEditDriver'));
const FmDriverProfile = lazy(() => import('./pages/fleet-manager/FmDriverProfile'));
const FmCompliance = lazy(() => import('./pages/fleet-manager/FmCompliance'));
const FmTrips = lazy(() => import('./pages/fleet-manager/FmTrips'));
const FmLiveTracking = lazy(() => import('./pages/fleet-manager/FmLiveTracking'));
const FmMaintenance = lazy(() => import('./pages/fleet-manager/FmMaintenance'));
const FmScheduleMaintenance = lazy(() => import('./pages/fleet-manager/FmScheduleMaintenance'));
const FmDocuments = lazy(() => import('./pages/fleet-manager/FmDocuments'));
const FmDocumentRelated = lazy(() => import('./pages/fleet-manager/FmDocumentRelated'));
const FmUploadDocument = lazy(() => import('./pages/fleet-manager/FmUploadDocument'));
const FmAnalytics = lazy(() => import('./pages/fleet-manager/FmAnalytics'));
const FmTransactions = lazy(() => import('./pages/fleet-manager/FmTransactions'));
const FmProfile = lazy(() => import('./pages/fleet-manager/FmProfile'));
const FmSettings = lazy(() => import('./pages/fleet-manager/FmSettings'));

const BusinessClientLayout = lazy(() => import('./layouts/BusinessClientLayout'));
const BcDashboard = lazy(() => import('./pages/business-client/BcDashboard'));
const BcCreateDelivery = lazy(() => import('./pages/business-client/BcCreateDelivery'));
const BcActiveDeliveries = lazy(() => import('./pages/business-client/BcActiveDeliveries'));
const BcCompletedDeliveries = lazy(() => import('./pages/business-client/BcCompletedDeliveries'));
const BcInvoices = lazy(() => import('./pages/business-client/BcInvoices'));
const BcInvoiceView = lazy(() => import('./pages/business-client/BcInvoiceView'));
const BcSubmitTransaction = lazy(() => import('./pages/business-client/BcSubmitTransaction'));
const BcCancelOrder = lazy(() => import('./pages/business-client/BcCancelOrder'));
const BcFeedback = lazy(() => import('./pages/business-client/BcFeedback'));
const BcLiveTracking = lazy(() => import('./pages/business-client/BcLiveTracking'));
const BcProfile = lazy(() => import('./pages/business-client/BcProfile'));

export default function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<p role="status">Loading page…</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/register-business-client" element={<RegisterBusinessClient />} />
            <Route path="/register-driver" element={<RegisterDriver />} />
            <Route path="/register-fleet-manager" element={<RegisterFleetManager />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Driver portal */}
            <Route path="/driver" element={<RequireRole role="driver" />}>
              <Route element={<DriverLayout />}>
                <Route path="dashboard" element={<DriverDashboard />} />
                <Route path="map" element={<DriverMap />} />
                <Route path="history" element={<DriverHistory />} />
                <Route path="earnings" element={<DriverEarnings />} />
                <Route path="task-details" element={<DriverTaskDetails />} />
                <Route path="report-issue" element={<DriverReportIssue />} />
                <Route path="proof-of-delivery" element={<DriverProofOfDelivery />} />
                <Route path="notifications" element={<DriverNotifications />} />
                <Route path="profile" element={<DriverProfile />} />
                <Route path="tasks" element={<DriverTasks />} />
                <Route path="messages" element={<DriverMessages />} />
              </Route>
            </Route>

            {/* Superuser portal */}
            <Route path="/superuser" element={<RequireRole role="superuser" />}>
              <Route element={<SuperuserLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<SuDashboard />} />
                <Route path="manage-users" element={<SuManageUsers />} />
                <Route path="approvals" element={<SuApprovals />} />
                <Route path="add-user" element={<SuUserForm editMode={false} />} />
                <Route path="edit-user" element={<SuUserForm editMode={true} />} />
                <Route path="reports" element={<SuReports />} />
                <Route path="roles-fleet-manager" element={<SuRoles roleKey="fleet-manager" />} />
                <Route path="roles-business-client" element={<SuRoles roleKey="business-client" />} />
                <Route path="roles-driver" element={<SuRoles roleKey="driver" />} />
                <Route path="system-configuration" element={<SuSystemConfiguration />} />
                <Route path="delivery-requests" element={<SuDeliveryRequests />} />
                <Route path="trip-monitoring" element={<SuTripMonitoring />} />
                <Route path="vehicles" element={<SuVehicles />} />
                <Route path="maintenance" element={<SuMaintenance />} />
                <Route path="schedule-maintenance" element={<SuScheduleMaintenance />} />
                <Route path="transactions" element={<SuTransactions />} />
                <Route path="documents" element={<SuDocuments />} />
                <Route path="notifications" element={<SuNotifications />} />
                <Route path="profile" element={<SuProfile />} />
              </Route>
            </Route>

            {/* Fleet Manager portal */}
            <Route path="/fleet-manager" element={<RequireRole role="fleet-manager" />}>
              <Route element={<FleetManagerLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<FmDashboard />} />
                <Route path="vehicles" element={<FmVehicles />} />
                <Route path="add-vehicle" element={<FmAddVehicle />} />
                <Route path="edit-vehicle" element={<FmEditVehicle />} />
                <Route path="drivers" element={<FmDrivers />} />
                <Route path="add-driver" element={<FmAddDriver />} />
                <Route path="edit-driver" element={<FmEditDriver />} />
                <Route path="driver-profile" element={<FmDriverProfile />} />
                <Route path="compliance" element={<FmCompliance />} />
                <Route path="trips" element={<FmTrips />} />
                <Route path="live-tracking" element={<FmLiveTracking />} />
                <Route path="maintenance" element={<FmMaintenance />} />
                <Route path="schedule-maintenance" element={<FmScheduleMaintenance />} />
                <Route path="documents" element={<FmDocuments />} />
                <Route path="document-related" element={<FmDocumentRelated />} />
                <Route path="upload-document" element={<FmUploadDocument />} />
                <Route path="analytics" element={<FmAnalytics />} />
                <Route path="transactions" element={<FmTransactions />} />
                <Route path="notifications" element={<FmNotifications />} />
                <Route path="profile" element={<FmProfile />} />
                <Route path="settings" element={<FmSettings />} />
              </Route>
            </Route>

            {/* Business Client portal */}
            <Route path="/business-client" element={<RequireRole role="business-client" />}>
              <Route element={<BusinessClientLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<BcDashboard />} />
                <Route path="create-delivery" element={<BcCreateDelivery />} />
                <Route path="active-deliveries" element={<BcActiveDeliveries />} />
                <Route path="completed-deliveries" element={<BcCompletedDeliveries />} />
                <Route path="transactions" element={<BcInvoices />} />
                <Route path="invoices" element={<Navigate to="../transactions" replace />} />
                <Route path="invoice-view" element={<BcInvoiceView />} />
                <Route path="submit-transaction" element={<BcSubmitTransaction />} />
                <Route path="cancel-order" element={<BcCancelOrder />} />
                <Route path="feedback" element={<BcFeedback />} />
                <Route path="live-tracking" element={<BcLiveTracking />} />
                <Route path="notifications" element={<BcNotifications />} />
                <Route path="profile" element={<BcProfile />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </SessionProvider>
  );
}
