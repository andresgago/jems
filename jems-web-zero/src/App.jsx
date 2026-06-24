import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import LoadsPage from './pages/loads/LoadsPage';
import LoadFormPage from './pages/loads/LoadFormPage';
import LoadDetailPage from './pages/loads/LoadDetailPage';
import DriversPage from './pages/drivers/DriversPage';
import DriverFormPage from './pages/drivers/DriverFormPage';
import DriverDetailPage from './pages/drivers/DriverDetailPage';
import TrucksPage from './pages/fleet/TrucksPage';
import TruckFormPage from './pages/fleet/TruckFormPage';
import TruckDetailPage from './pages/fleet/TruckDetailPage';
import TrailersPage from './pages/fleet/TrailersPage';
import TrailerFormPage from './pages/fleet/TrailerFormPage';
import TrailerDetailPage from './pages/fleet/TrailerDetailPage';
import BrokersPage from './pages/brokers/BrokersPage';
import BrokerFormPage from './pages/brokers/BrokerFormPage';
import BrokerDetailPage from './pages/brokers/BrokerDetailPage';
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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Routes>
                <Route index element={<HomePage />} />
                {/* Loads */}
                <Route path="loads" element={<LoadsPage />} />
                <Route path="loads/create" element={<LoadFormPage />} />
                <Route path="loads/:id" element={<LoadDetailPage />} />
                <Route path="loads/:id/edit" element={<LoadFormPage />} />
                <Route path="loads/history" element={<div><h5>Load History</h5><p className="text-muted">Coming soon.</p></div>} />
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
                <Route path="fleet/truck-maintenance" element={<div><h5>Truck Maintenance</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="fleet/truck-maintenance/create" element={<div><h5>Create Truck Maintenance</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="fleet/trailer-maintenance" element={<div><h5>Trailer Maintenance</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="fleet/trailer-maintenance/create" element={<div><h5>Create Trailer Maintenance</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="fleet/accidents" element={<div><h5>Accidents</h5><p className="text-muted">Coming soon.</p></div>} />
                {/* Accounting */}
                <Route path="accounting/records" element={<RecordsPage />} />
                <Route path="accounting/records/create" element={<RecordFormPage />} />
                <Route path="accounting/records/:id" element={<RecordDetailPage />} />
                <Route path="accounting/records/:id/edit" element={<RecordFormPage />} />
                <Route path="accounting/invoices/drivers" element={<DriverInvoicesPage />} />
                <Route path="accounting/invoices/drivers/:id" element={<DriverInvoiceDetailPage />} />
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
                <Route path="brokers/:id" element={<BrokerDetailPage />} />
                <Route path="brokers/:id/edit" element={<BrokerFormPage />} />
                {/* Dispatch */}
                <Route path="dispatch/my-calendar" element={<DispatchWorkPage selfOnly={true} />} />
                <Route path="dispatch/calendar" element={<DispatchWorkPage />} />
                <Route path="dispatch/work/create" element={<DispatchWorkFormPage />} />
                <Route path="dispatch/work/:id/edit" element={<DispatchWorkFormPage />} />
                {/* RTL */}
                <Route path="rtl" element={<div><h5>RTL – Trucks / Drivers</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="rtl/ifta" element={<div><h5>IFTA</h5><p className="text-muted">Coming soon.</p></div>} />
                {/* Reports */}
                <Route path="reports/financial" element={<div><h5>Profit and Loss</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="reports/invoice" element={<div><h5>Profit and Loss By Invoices</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="reports/ifta" element={<div><h5>IFTA Report</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="reports/tax" element={<div><h5>Tax Report</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="reports/category-tracking" element={<div><h5>Category Tracking</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="reports/broker-summary" element={<div><h5>Broker Summary</h5><p className="text-muted">Coming soon.</p></div>} />
                {/* Settings */}
                <Route path="settings/carriers" element={<div><h5>Carriers</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/truck-owners" element={<div><h5>Truck Owners</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/loss-payees" element={<div><h5>Loss Payees</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/driver-types" element={<div><h5>Driver Types</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/trailer-types" element={<div><h5>Trailer Types</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/truck-types" element={<div><h5>Truck Types</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/business" element={<div><h5>Business</h5><p className="text-muted">Coming soon.</p></div>} />
                <Route path="settings/cities" element={<div><h5>Cities</h5><p className="text-muted">Coming soon.</p></div>} />
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
