import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import ProtectedRoute from './components/layout/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import LoadsPage from './pages/loads/LoadsPage';
import LoadFormPage from './pages/loads/LoadFormPage';
import LoadDetailPage from './pages/loads/LoadDetailPage';
import ExecutedPage from './pages/loads/ExecutedPage';
import InvoicingPage from './pages/loads/InvoicingPage';
import PaymentsPage from './pages/loads/PaymentsPage';
import HistoryPage from './pages/loads/HistoryPage';
import DriversPage from './pages/drivers/DriversPage';
import DriverFormPage from './pages/drivers/DriverFormPage';
import DriverDetailPage from './pages/drivers/DriverDetailPage';
import DriverListReportPrintPage from './pages/drivers/DriverListReportPrintPage';
import DriverExportPrintPage from './pages/drivers/DriverExportPrintPage';
import TrucksPage from './pages/fleet/TrucksPage';
import TruckFormPage from './pages/fleet/TruckFormPage';
import TruckDetailPage from './pages/fleet/TruckDetailPage';
import TrailersPage from './pages/fleet/TrailersPage';
import TrailerFormPage from './pages/fleet/TrailerFormPage';
import TrailerDetailPage from './pages/fleet/TrailerDetailPage';
import BrokersPage from './pages/brokers/BrokersPage';
import BrokerFormPage from './pages/brokers/BrokerFormPage';
import BrokerDetailPage from './pages/brokers/BrokerDetailPage';
import BrokerContactsPage from './pages/brokers/BrokerContactsPage';
import RecordsPage from './pages/accounting/RecordsPage';
import RecordDetailPage from './pages/accounting/RecordDetailPage';
import RecordFormPage from './pages/accounting/RecordFormPage';
import DriverInvoicesPage from './pages/accounting/DriverInvoicesPage';
import DriverInvoiceDetailPage from './pages/accounting/DriverInvoiceDetailPage';
import DispatchPercentInvoicesPage from './pages/accounting/DispatchPercentInvoicesPage';
import DispatchPercentInvoiceDetailPage from './pages/accounting/DispatchPercentInvoiceDetailPage';
import DispatchPercentInvoiceFormPage from './pages/accounting/DispatchPercentInvoiceFormPage';
import DispatchHourInvoicesPage from './pages/accounting/DispatchHourInvoicesPage';
import DispatchHourInvoiceDetailPage from './pages/accounting/DispatchHourInvoiceDetailPage';
import DispatchHourInvoiceFormPage from './pages/accounting/DispatchHourInvoiceFormPage';
import DispatchWorkPage from './pages/dispatch/DispatchWorkPage';
import DispatchWorkFormPage from './pages/dispatch/DispatchWorkFormPage';
import CitiesPage from './pages/settings/CitiesPage';
import CityDetailPage from './pages/settings/CityDetailPage';
import CityFormPage from './pages/settings/CityFormPage';
import BusinessesPage from './pages/settings/BusinessesPage';
import UsersPage from './pages/settings/UsersPage';
import UserDetailPage from './pages/settings/UserDetailPage';
import UserFormPage from './pages/settings/UserFormPage';
import SystemSettingsPage from './pages/settings/SystemSettingsPage';
import TruckOwnersPage from './pages/settings/TruckOwnersPage';
import RtlPage from './pages/integrations/RtlPage';
import RtlDriverDetailPage from './pages/integrations/RtlDriverDetailPage';
import RtlTruckDetailPage from './pages/integrations/RtlTruckDetailPage';
import IftaPage from './pages/integrations/IftaPage';
import SendPacketPage from './pages/tools/SendPacketPage';
import BrokersStatusPage from './pages/tools/BrokersStatusPage';
import DriversLastLoadsPage from './pages/tools/DriversLastLoadsPage';
import FinancialReportPage from './pages/reports/FinancialReportPage';
import FinancialReportPrintPage from './pages/reports/FinancialReportPrintPage';
import InvoiceReportPrintPage from './pages/reports/InvoiceReportPrintPage';
import InvoiceReportPage from './pages/reports/InvoiceReportPage';
import BalanceSheetReportPage from './pages/reports/BalanceSheetReportPage';
import BalanceSheetReportPrintPage from './pages/reports/BalanceSheetReportPrintPage';
import IftaReportPage from './pages/reports/IftaReportPage';
import IftaReportPrintPage from './pages/reports/IftaReportPrintPage';
import TaxReportPage from './pages/reports/TaxReportPage';
import TaxReportPrintPage from './pages/reports/TaxReportPrintPage';
import CategoryTrackingReportPage from './pages/reports/CategoryTrackingReportPage';
import CategoryTrackingReportPrintPage from './pages/reports/CategoryTrackingReportPrintPage';
import InvoiceAnalysisPage from './pages/reports/InvoiceAnalysisPage';
import BrokerSummaryReportPage from './pages/reports/BrokerSummaryReportPage';
import BrokerSummaryReportPrintPage from './pages/reports/BrokerSummaryReportPrintPage';
import ShipperReceiverReportPage from './pages/reports/ShipperReceiverReportPage';
import ShipperReceiverReportPrintPage from './pages/reports/ShipperReceiverReportPrintPage';
import TruckMaintenancesPage from './pages/fleet/TruckMaintenancesPage';
import TruckMaintenanceFormPage from './pages/fleet/TruckMaintenanceFormPage';
import TrailerMaintenancesPage from './pages/fleet/TrailerMaintenancesPage';
import TrailerMaintenanceFormPage from './pages/fleet/TrailerMaintenanceFormPage';
import TruckMilesResetPage from './pages/fleet/TruckMilesResetPage';
import AccidentsPage from './pages/fleet/AccidentsPage';
import AccidentDetailPage from './pages/fleet/AccidentDetailPage';
import AccidentFormPage from './pages/fleet/AccidentFormPage';
import CategoriesPage from './pages/accounting/CategoriesPage';
import CategoryDetailPage from './pages/accounting/CategoryDetailPage';
import CategoryFormPage from './pages/accounting/CategoryFormPage';
import TruckPartsReportPage from './pages/fleet/TruckPartsReportPage';
import TruckPartsReportPrintPage from './pages/fleet/TruckPartsReportPrintPage';
import TruckListReportPrintPage from './pages/fleet/TruckListReportPrintPage';
import TruckExportPrintPage from './pages/fleet/TruckExportPrintPage';

export function RequireAnyPermission({ permissions, children }) {
  const { haveAnyPermission } = useAuth();
  if (!haveAnyPermission(permissions)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/print/financial" element={<ProtectedRoute><FinancialReportPrintPage /></ProtectedRoute>} />
      <Route path="/print/invoice" element={<ProtectedRoute><InvoiceReportPrintPage /></ProtectedRoute>} />
      <Route path="/print/balance-sheet" element={<ProtectedRoute><BalanceSheetReportPrintPage /></ProtectedRoute>} />
      <Route path="/print/ifta" element={<ProtectedRoute><IftaReportPrintPage /></ProtectedRoute>} />
      <Route path="/print/tax" element={<ProtectedRoute><TaxReportPrintPage /></ProtectedRoute>} />
      <Route path="/print/category-tracking" element={<ProtectedRoute><CategoryTrackingReportPrintPage /></ProtectedRoute>} />
      <Route path="/print/broker-summary" element={<ProtectedRoute><BrokerSummaryReportPrintPage /></ProtectedRoute>} />
      <Route path="/print/shipper-receiver" element={<ProtectedRoute><ShipperReceiverReportPrintPage /></ProtectedRoute>} />
      <Route path="/print/fleet/truck-parts" element={<ProtectedRoute><TruckPartsReportPrintPage /></ProtectedRoute>} />
      <Route path="/print/drivers" element={<ProtectedRoute><DriverListReportPrintPage /></ProtectedRoute>} />
      <Route path="/print/drivers/export" element={<ProtectedRoute><DriverExportPrintPage /></ProtectedRoute>} />
      <Route path="/print/trucks" element={<ProtectedRoute><TruckListReportPrintPage /></ProtectedRoute>} />
      <Route path="/print/trucks/export" element={<ProtectedRoute><TruckExportPrintPage /></ProtectedRoute>} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Routes>
                <Route index element={<HomePage />} />
                {/* Loads — static sub-paths must precede :id to avoid param collisions */}
                <Route path="loads" element={<RequireAnyPermission permissions={['admin', 'dispatcher']}><LoadsPage /></RequireAnyPermission>} />
                <Route path="loads/create" element={<RequireAnyPermission permissions={['admin', 'dispatcher']}><LoadFormPage /></RequireAnyPermission>} />
                <Route path="loads/executed" element={<RequireAnyPermission permissions={['admin', 'dispatcher']}><ExecutedPage /></RequireAnyPermission>} />
                <Route path="loads/invoicing" element={<RequireAnyPermission permissions={['admin', 'dispatcher']}><InvoicingPage /></RequireAnyPermission>} />
                <Route path="loads/payments" element={<RequireAnyPermission permissions={['admin', 'dispatcher']}><PaymentsPage /></RequireAnyPermission>} />
                <Route path="loads/history" element={<RequireAnyPermission permissions={['admin', 'dispatcher']}><HistoryPage /></RequireAnyPermission>} />
                <Route path="loads/:id" element={<RequireAnyPermission permissions={['admin', 'dispatcher']}><LoadDetailPage /></RequireAnyPermission>} />
                <Route path="loads/:id/edit" element={<RequireAnyPermission permissions={['admin', 'dispatcher']}><LoadFormPage /></RequireAnyPermission>} />
                {/* Drivers */}
                <Route path="drivers" element={<DriversPage />} />
                <Route path="drivers/create" element={<DriverFormPage />} />
                <Route path="drivers/:id" element={<DriverDetailPage />} />
                <Route path="drivers/:id/edit" element={<DriverFormPage />} />
                {/* Fleet */}
                <Route path="fleet/trucks" element={<TrucksPage />} />
                <Route path="fleet/trucks/create" element={<TruckFormPage />} />
                <Route path="fleet/trucks/:id" element={<TruckDetailPage />} />
                <Route path="fleet/trucks/:id/edit" element={<TruckFormPage />} />
                <Route path="fleet/trailers" element={<TrailersPage />} />
                <Route path="fleet/trailers/create" element={<TrailerFormPage />} />
                <Route path="fleet/trailers/:id" element={<TrailerDetailPage />} />
                <Route path="fleet/trailers/:id/edit" element={<TrailerFormPage />} />
                <Route path="fleet/truck-maintenance" element={<TruckMaintenancesPage />} />
                <Route path="fleet/truck-maintenance/create" element={<TruckMaintenanceFormPage />} />
                <Route path="fleet/truck-maintenance/:id/edit" element={<TruckMaintenanceFormPage />} />
                <Route path="fleet/truck-miles-reset" element={<TruckMilesResetPage />} />
                <Route path="fleet/trailer-maintenance" element={<TrailerMaintenancesPage />} />
                <Route path="fleet/trailer-maintenance/create" element={<TrailerMaintenanceFormPage />} />
                <Route path="fleet/trailer-maintenance/:id/edit" element={<TrailerMaintenanceFormPage />} />
                <Route path="fleet/reports/truck-parts" element={<TruckPartsReportPage />} />
                <Route path="fleet/accidents" element={<AccidentsPage />} />
                <Route path="fleet/accidents/create" element={<AccidentFormPage />} />
                <Route path="fleet/accidents/:id" element={<AccidentDetailPage />} />
                <Route path="fleet/accidents/:id/edit" element={<AccidentFormPage />} />
                {/* Accounting */}
                <Route path="accounting/records" element={<RecordsPage />} />
                <Route path="accounting/records/create" element={<RecordFormPage />} />
                <Route path="accounting/records/create-assistant" element={<div><h5>Add Record (Assistant)</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="accounting/records/:id" element={<RecordDetailPage />} />
                <Route path="accounting/records/:id/edit" element={<RecordFormPage />} />
                <Route path="accounting/invoices/drivers" element={<DriverInvoicesPage />} />
                <Route path="accounting/invoices/drivers/:id" element={<DriverInvoiceDetailPage />} />
                <Route path="accounting/categories" element={<CategoriesPage />} />
                <Route path="accounting/categories/create" element={<CategoryFormPage />} />
                <Route path="accounting/categories/:id" element={<CategoryDetailPage />} />
                <Route path="accounting/categories/:id/edit" element={<CategoryFormPage />} />
                <Route path="accounting/category-types" element={<div><h5>Types of Categories</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="accounting/units" element={<div><h5>Units of Measurements</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="accounting/positions" element={<div><h5>Positions</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="accounting/cards" element={<div><h5>Cards</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="accounting/accounts" element={<div><h5>Accounts</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="accounting/factor-percent" element={<div><h5>Factor Percent List</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="accounting/driver-vacations" element={<div><h5>Vacations of Drivers</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="accounting/fix-invoices" element={<div><h5>Fix Invoices</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="accounting/owner-operator" element={<div><h5>Owner Operator</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="accounting/dispatcher-percent" element={<DispatchPercentInvoicesPage />} />
                <Route path="accounting/dispatcher-hour" element={<DispatchHourInvoicesPage />} />
                <Route path="accounting/invoices/dispatchers-percent" element={<DispatchPercentInvoicesPage />} />
                <Route path="accounting/invoices/dispatchers-percent/create" element={<DispatchPercentInvoiceFormPage />} />
                <Route path="accounting/invoices/dispatchers-percent/:id" element={<DispatchPercentInvoiceDetailPage />} />
                <Route path="accounting/invoices/dispatchers-percent/:id/edit" element={<DispatchPercentInvoiceFormPage />} />
                <Route path="accounting/invoices/dispatchers-hour" element={<DispatchHourInvoicesPage />} />
                <Route path="accounting/invoices/dispatchers-hour/create" element={<DispatchHourInvoiceFormPage />} />
                <Route path="accounting/invoices/dispatchers-hour/:id" element={<DispatchHourInvoiceDetailPage />} />
                <Route path="accounting/invoices/dispatchers-hour/:id/edit" element={<DispatchHourInvoiceFormPage />} />
                {/* Brokers */}
                <Route path="brokers" element={<BrokersPage />} />
                <Route path="brokers/create" element={<BrokerFormPage />} />
                <Route path="brokers/contacts" element={<BrokerContactsPage />} />
                <Route path="brokers/:id" element={<BrokerDetailPage />} />
                <Route path="brokers/:id/edit" element={<BrokerFormPage />} />
                {/* Dispatch */}
                <Route path="dispatch/my-calendar" element={<DispatchWorkPage selfOnly={true} />} />
                <Route path="dispatch/calendar" element={<DispatchWorkPage />} />
                <Route path="dispatch/work/create" element={<DispatchWorkFormPage />} />
                <Route path="dispatch/work/:id/edit" element={<DispatchWorkFormPage />} />
                {/* Factoring */}
                <Route path="factoring/loads" element={<div><h5>Factoring Loads</h5><p className="text-muted">Coming soon.</p></div>} />
                {/* Tools */}
                <Route path="tools/drivers-last-loads" element={<DriversLastLoadsPage />} />
                <Route path="tools/send-packet" element={<SendPacketPage />} />
                <Route path="tools/brokers-status" element={<BrokersStatusPage />} />
                {/* RTL */}
                <Route path="rtl" element={<RtlPage />} />
                <Route path="rtl/drivers/:id" element={<RtlDriverDetailPage />} />
                <Route path="rtl/trucks/:id" element={<RtlTruckDetailPage />} />
                <Route path="rtl/ifta" element={<IftaPage />} />
                {/* Reports */}
                <Route path="reports/financial" element={<FinancialReportPage />} />
                <Route path="reports/invoice" element={<InvoiceReportPage />} />
                <Route path="reports/balance-sheet" element={<BalanceSheetReportPage />} />
                <Route path="reports/company-invoices" element={<InvoiceAnalysisPage />} />
                <Route path="reports/ifta" element={<IftaReportPage />} />
                <Route path="reports/tax" element={<TaxReportPage />} />
                <Route path="reports/category-tracking" element={<CategoryTrackingReportPage />} />
                <Route path="reports/broker-summary" element={<BrokerSummaryReportPage />} />
                <Route path="reports/shipper-receiver" element={<ShipperReceiverReportPage />} />
                {/* Settings */}
                <Route path="settings/carriers" element={<div><h5>Carriers</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/eld" element={<div><h5>ELD</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/truck-owners" element={<TruckOwnersPage />} />
                <Route path="settings/loss-payees" element={<div><h5>Loss Payees</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/driver-types" element={<div><h5>Driver Types</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/trailer-types" element={<div><h5>Trailer Types</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/truck-types" element={<div><h5>Truck Types</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/engines" element={<div><h5>Engines</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/models" element={<div><h5>Models</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/transmission" element={<div><h5>Transmission</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/tires-size" element={<div><h5>Tires Size</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/make" element={<div><h5>Make</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/roles" element={<div><h5>Roles</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/permissions" element={<div><h5>Permission</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/role-assignment" element={<div><h5>Role Assignment</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/rules" element={<div><h5>Rules</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/business" element={<BusinessesPage />} />
                <Route path="settings/cities" element={<CitiesPage />} />
                <Route path="settings/cities/create" element={<CityFormPage />} />
                <Route path="settings/cities/:id" element={<CityDetailPage />} />
                <Route path="settings/cities/:id/edit" element={<CityFormPage />} />
                <Route path="settings/users" element={<RequireAnyPermission permissions={['admin']}><UsersPage /></RequireAnyPermission>} />
                <Route path="settings/users/create" element={<RequireAnyPermission permissions={['admin']}><UserFormPage /></RequireAnyPermission>} />
                <Route path="settings/users/:id" element={<RequireAnyPermission permissions={['admin']}><UserDetailPage /></RequireAnyPermission>} />
                <Route path="settings/users/:id/edit" element={<RequireAnyPermission permissions={['admin']}><UserFormPage /></RequireAnyPermission>} />
                <Route path="settings/system" element={<SystemSettingsPage />} />
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </MainLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
