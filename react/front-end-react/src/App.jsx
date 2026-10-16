import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SessionProvider } from './auth/SessionContext';
import { ToastProvider } from './hooks/useToast';
import RequireRole from './auth/RequireRole';

import Login from './pages/auth/Login';
import Home from './pages/public/Home';
import About from './pages/public/About';
import Roles from './pages/public/Roles';
import RegisterBusinessClient from './pages/public/RegisterBusinessClient';
import RegisterDriver from './pages/public/RegisterDriver';
import RegisterFleetManager from './pages/public/RegisterFleetManager';

import DriverLayout from './layouts/DriverLayout';
import DriverDashboard from './pages/driver/DriverDashboard';
import DriverMap from './pages/driver/DriverMap';
import DriverHistory from './pages/driver/DriverHistory';
import DriverEarnings from './pages/driver/DriverEarnings';
import DriverTaskDetails from './pages/driver/DriverTaskDetails';
import DriverReportIssue from './pages/driver/DriverReportIssue';
import DriverProofOfDelivery from './pages/driver/DriverProofOfDelivery';
import DriverProfile from './pages/driver/DriverProfile';
import { DriverNotifications, SuNotifications, FmNotifications, BcNotifications } from './components/NotificationInbox';
import DriverTasks from './pages/driver/DriverTasks';
import DriverMessages from './pages/driver/DriverMessages';

import SuperuserLayout from './layouts/SuperuserLayout';
import SuDashboard from './pages/superuser/SuDashboard';
import SuManageUsers from './pages/superuser/SuManageUsers';
import SuUserForm from './pages/superuser/SuUserForm';
import SuReports from './pages/superuser/SuReports';
import SuRoles from './pages/superuser/SuRoles';
import SuSystemConfiguration from './pages/superuser/SuSystemConfiguration';
import SuDeliveryRequests from './pages/superuser/SuDeliveryRequests';
import SuTripMonitoring from './pages/superuser/SuTripMonitoring';
import SuVehicles from './pages/superuser/SuVehicles';
import SuMaintenance from './pages/superuser/SuMaintenance';
import SuScheduleMaintenance from './pages/superuser/SuScheduleMaintenance';
import SuTransactions from './pages/superuser/SuTransactions';
import SuDocuments from './pages/superuser/SuDocuments';
import SuProfile from './pages/superuser/SuProfile';
import SuApprovals from './pages/superuser/SuApprovals';

import FleetManagerLayout from './layouts/FleetManagerLayout';
import FmDashboard from './pages/fleet-manager/FmDashboard';
import FmVehicles from './pages/fleet-manager/FmVehicles';
import FmAddVehicle from './pages/fleet-manager/FmAddVehicle';
import FmEditVehicle from './pages/fleet-manager/FmEditVehicle';
import FmDrivers from './pages/fleet-manager/FmDrivers';
import FmAddDriver from './pages/fleet-manager/FmAddDriver';
import FmEditDriver from './pages/fleet-manager/FmEditDriver';
import FmDriverProfile from './pages/fleet-manager/FmDriverProfile';
import FmCompliance from './pages/fleet-manager/FmCompliance';
import FmTrips from './pages/fleet-manager/FmTrips';
import FmLiveTracking from './pages/fleet-manager/FmLiveTracking';
import FmMaintenance from './pages/fleet-manager/FmMaintenance';
import FmScheduleMaintenance from './pages/fleet-manager/FmScheduleMaintenance';
import FmDocuments from './pages/fleet-manager/FmDocuments';
import FmDocumentRelated from './pages/fleet-manager/FmDocumentRelated';
import FmUploadDocument from './pages/fleet-manager/FmUploadDocument';
import FmAnalytics from './pages/fleet-manager/FmAnalytics';
import FmTransactions from './pages/fleet-manager/FmTransactions';
import FmProfile from './pages/fleet-manager/FmProfile';
import FmSettings from './pages/fleet-manager/FmSettings';

import BusinessClientLayout from './layouts/BusinessClientLayout';
import BcDashboard from './pages/business-client/BcDashboard';
import BcCreateDelivery from './pages/business-client/BcCreateDelivery';
import BcActiveDeliveries from './pages/business-client/BcActiveDeliveries';
import BcCompletedDeliveries from './pages/business-client/BcCompletedDeliveries';
import BcInvoices from './pages/business-client/BcInvoices';
import BcInvoiceView from './pages/business-client/BcInvoiceView';
import BcSubmitTransaction from './pages/business-client/BcSubmitTransaction';
import BcCancelOrder from './pages/business-client/BcCancelOrder';
import BcFeedback from './pages/business-client/BcFeedback';
import BcLiveTracking from './pages/business-client/BcLiveTracking';
import BcProfile from './pages/business-client/BcProfile';

export default function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/register-business-client" element={<RegisterBusinessClient />} />
            <Route path="/register-driver" element={<RegisterDriver />} />
            <Route path="/register-fleet-manager" element={<RegisterFleetManager />} />
            <Route path="/login" element={<Login />} />

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

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </SessionProvider>
  );
}
