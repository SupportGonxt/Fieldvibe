import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'
import { useEffect } from 'react'

// Layout Components
import AuthLayout from './components/layout/AuthLayout'
import DashboardLayout from './components/layout/DashboardLayout'
import ErrorBoundary from './components/ui/ErrorBoundary'

// Auth Pages
import LoginPage from './pages/auth/LoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'

// Dashboard Pages
import DashboardPage from './pages/dashboard/DashboardPage'
import AnalyticsPage from './pages/dashboard/AnalyticsPage'

// Van Sales Pages
import VanSalesPage from './pages/van-sales/VanSalesPage'
import VanSalesDashboard from './pages/van-sales/VanSalesDashboard'
import VanSalesWorkflowPage from './pages/van-sales/VanSalesWorkflowPage'
import RouteManagementPage from './pages/van-sales/RouteManagementPage'
import InventoryTrackingPage from './pages/van-sales/InventoryTrackingPage'

// Trade Marketing Pages
import TradeMarketingPage from './pages/trade-marketing/TradeMarketingPage'
import ActivationWorkflowPage from './pages/trade-marketing/ActivationWorkflowPage'
import CampaignManagementPage from './pages/trade-marketing/CampaignManagementPage'
import MerchandisingCompliancePage from './pages/trade-marketing/MerchandisingCompliancePage'
import PromoterManagementPage from './pages/trade-marketing/PromoterManagementPage'
import TradeMarketingAnalyticsPage from './pages/trade-marketing/TradeMarketingAnalyticsPage'

// Events Pages
import EventsPage from './pages/events/EventsPage'

// Campaign Pages
import CampaignsPage from './pages/campaigns/CampaignsPage'

// Field Operations Pages
import FieldOperationsDashboard from './pages/field-operations/FieldOperationsDashboard'

// Field Marketing Pages

import VanSalesWorkflowPageMobile from './pages/van-sales/VanSalesWorkflowPageMobile'
import BoardPlacementFormPage from './pages/field-operations/BoardPlacementFormPage'
import ProductDistributionFormPage from './pages/field-operations/ProductDistributionFormPage'

// KYC Pages
import KYCDashboard from './pages/kyc/KYCDashboard'
import KYCManagement from './pages/kyc/KYCManagement'
import KYCReports from './pages/kyc/KYCReports'

// Surveys Pages
import SurveysDashboard from './pages/surveys/SurveysDashboard'
import SurveysManagement from './pages/surveys/SurveysManagement'
import SurveyCreate from './pages/surveys/SurveyCreate'
import SurveyEdit from './pages/surveys/SurveyEdit'

// Inventory Pages
import InventoryDashboard from './pages/inventory/InventoryDashboard'
import InventoryManagement from './pages/inventory/InventoryManagement'
import InventoryReports from './pages/inventory/InventoryReports'
import StockCountWorkflowPage from './pages/inventory/StockCountWorkflowPage'

// Promotions Pages
import PromotionsDashboard from './pages/promotions/PromotionsDashboard'
import PromotionsManagement from './pages/promotions/PromotionsManagement'

// Business Pages
import CustomersPage from './pages/customers/CustomersPage'
import CustomerDetailsPage from './pages/customers/CustomerDetailsPage'
import CustomerEditPage from './pages/customers/CustomerEditPage'
import CustomerCreatePage from './pages/customers/CustomerCreatePage'
import OrdersPage from './pages/orders/OrdersPage'
import OrderDetailsPage from './pages/orders/OrderDetailsPage'
import OrderEditPage from './pages/orders/OrderEditPage'
import OrderCreatePage from './pages/orders/OrderCreatePage'
import ProductsPage from './pages/products/ProductsPage'
import ProductDetailsPage from './pages/products/ProductDetailsPage'
import ProductEditPage from './pages/products/ProductEditPage'
import ProductCreatePage from './pages/products/ProductCreatePage'

import BrandsList from './pages/brands/BrandsList'
import BrandDetail from './pages/brands/BrandDetail'
import BrandEdit from './pages/brands/BrandEdit'
import BrandCreate from './pages/brands/BrandCreate'
import BrandSurveys from './pages/brands/BrandSurveys'
import BrandActivations from './pages/brands/BrandActivations'
import BrandBoards from './pages/brands/BrandBoards'
import BrandProducts from './pages/brands/BrandProducts'

import CustomerOrders from './pages/customers/tabs/CustomerOrders'
import CustomerVisits from './pages/customers/tabs/CustomerVisits'
import CustomerPayments from './pages/customers/tabs/CustomerPayments'
import CustomerSurveys from './pages/customers/tabs/CustomerSurveys'
import CustomerKYC from './pages/customers/tabs/CustomerKYC'

import ProductInventory from './pages/products/tabs/ProductInventory'
import ProductPricing from './pages/products/tabs/ProductPricing'
import ProductPromotions from './pages/products/tabs/ProductPromotions'
import ProductSales from './pages/products/tabs/ProductSales'

import OrderItems from './pages/orders/tabs/OrderItems'
import OrderPayments from './pages/orders/tabs/OrderPayments'
import OrderDelivery from './pages/orders/tabs/OrderDelivery'
import OrderReturns from './pages/orders/tabs/OrderReturns'

// Van Sales Detail Pages
import VanOrderCreatePage from './pages/van-sales/VanOrderCreatePage'
import VanRouteDetailsPage from './pages/van-sales/VanRouteDetailsPage'
import VanSalesOrderCreate from './pages/van-sales/orders/VanSalesOrderCreate'
import VanSalesOrderDetail from './pages/van-sales/orders/VanSalesOrderDetail'
import VanSalesOrderEdit from './pages/van-sales/orders/VanSalesOrderEdit'
import VanSalesReturnCreate from './pages/van-sales/returns/VanSalesReturnCreate'
import VanSalesReturnDetail from './pages/van-sales/returns/VanSalesReturnDetail'
import VanLoadCreate from './pages/van-sales/van-loads/VanLoadCreate'
import VanLoadDetail from './pages/van-sales/van-loads/VanLoadDetail'
import VanCashReconciliationCreate from './pages/van-sales/cash-reconciliation/CashReconciliationCreate'
import VanCashReconciliationDetail from './pages/van-sales/cash-reconciliation/CashReconciliationDetail'

// Van Sales Depth Pages
import RouteDetail from './pages/van-sales-depth/RouteDetail'
import RouteEdit from './pages/van-sales-depth/RouteEdit'
import RouteCreate from './pages/van-sales-depth/RouteCreate'
import RouteCustomers from './pages/van-sales-depth/RouteCustomers'
import RouteOrders from './pages/van-sales-depth/RouteOrders'
import RoutePerformance from './pages/van-sales-depth/RoutePerformance'

import CommissionDetail from './pages/commissions/CommissionDetail'
import CommissionEdit from './pages/commissions/CommissionEdit'
import CommissionCreate from './pages/commissions/CommissionCreate'
import RuleDetail from './pages/commissions/RuleDetail'
import RuleEdit from './pages/commissions/RuleEdit'
import RuleCreate from './pages/commissions/RuleCreate'

import KYCDetail from './pages/kyc/KYCDetail'
import KYCEdit from './pages/kyc/KYCEdit'
import KYCCreate from './pages/kyc/KYCCreate'

import SurveyResponses from './pages/surveys/SurveyResponses'
import SurveyAnalytics from './pages/surveys/SurveyAnalytics'

import ReportDetail from './pages/reports/ReportDetail'
import ReportEdit from './pages/reports/ReportEdit'
import ReportCreate from './pages/reports/ReportCreate'

import FinanceInvoiceDetail from './pages/finance/InvoiceDetail'
import FinanceInvoiceEdit from './pages/finance/InvoiceEdit'
import FinanceInvoiceCreate from './pages/finance/InvoiceCreate'
import FinancePaymentDetail from './pages/finance/PaymentDetail'
import FinancePaymentEdit from './pages/finance/PaymentEdit'
import FinancePaymentCreate from './pages/finance/PaymentCreate'
import InvoicePayments from './pages/finance/InvoicePayments'
import InvoiceItems from './pages/finance/InvoiceItems'

// Inventory Detail Pages
import AdjustmentCreate from './pages/inventory/adjustments/AdjustmentCreate'
import AdjustmentDetail from './pages/inventory/adjustments/AdjustmentDetail'
import IssueCreate from './pages/inventory/issues/IssueCreate'
import IssueDetail from './pages/inventory/issues/IssueDetail'
import ReceiptCreate from './pages/inventory/receipts/ReceiptCreate'
import ReceiptDetail from './pages/inventory/receipts/ReceiptDetail'
import StockCountCreate from './pages/inventory/stock-counts/StockCountCreate'
import StockCountDetail from './pages/inventory/stock-counts/StockCountDetail'
import TransferCreate from './pages/inventory/transfers/TransferCreate'
import TransferDetail from './pages/inventory/transfers/TransferDetail'

import CreditNoteCreate from './pages/sales/credit-notes/CreditNoteCreate'
import CreditNoteDetail from './pages/sales/credit-notes/CreditNoteDetail'
import InvoiceCreate from './pages/sales/invoices/InvoiceCreate'
import InvoiceDetail from './pages/sales/invoices/InvoiceDetail'
import SalesOrderCreate from './pages/sales/orders/SalesOrderCreate'
import SalesOrderDetail from './pages/sales/orders/SalesOrderDetail'
import SalesOrderEdit from './pages/sales/orders/SalesOrderEdit'
import PaymentCreate from './pages/sales/payments/PaymentCreate'
import PaymentDetail from './pages/sales/payments/PaymentDetail'
import SalesReturnCreate from './pages/sales/returns/SalesReturnCreate'
import SalesReturnDetail from './pages/sales/returns/SalesReturnDetail'

import ActivationCreate from './pages/marketing/activations/ActivationCreate'
import ActivationDetail from './pages/marketing/activations/ActivationDetail'
import CampaignCreate from './pages/marketing/campaigns/CampaignCreate'
import CampaignDetail from './pages/marketing/campaigns/CampaignDetail'
import CampaignEdit from './pages/marketing/campaigns/CampaignEdit'
import EventCreate from './pages/marketing/events/EventCreate'
import EventDetail from './pages/marketing/events/EventDetail'
import EventEdit from './pages/marketing/events/EventEdit'
import PromotionCreate from './pages/marketing/promotions/PromotionCreate'
import PromotionDetail from './pages/marketing/promotions/PromotionDetail'

// Field Operations Detail Pages
import BoardPlacementCreate from './pages/field-operations/board-placements/BoardPlacementCreate'
import BoardPlacementDetail from './pages/field-operations/board-placements/BoardPlacementDetail'
import CommissionLedgerDetail from './pages/field-operations/commission-ledger/CommissionLedgerDetail'
import ProductDistributionCreate from './pages/field-operations/product-distributions/ProductDistributionCreate'
import ProductDistributionDetail from './pages/field-operations/product-distributions/ProductDistributionDetail'
import VisitCreate from './pages/field-operations/visits/VisitCreate'
import VisitDetail from './pages/field-operations/visits/VisitDetail'
import VisitEdit from './pages/field-operations/visits/VisitEdit'
import VisitManagementPage from './pages/field-operations/VisitManagementPage'
import VisitConfigurationPage from './pages/field-operations/VisitConfigurationPage'

import CashReconciliationCreate from './pages/finance/cash-reconciliation/CashReconciliationCreate'
import CashReconciliationDetail from './pages/finance/cash-reconciliation/CashReconciliationDetail'
import CommissionPayoutDetail from './pages/finance/commission-payouts/CommissionPayoutDetail'

// Admin Pages
import AdminPage from './pages/admin/AdminPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagementPage from './pages/admin/UserManagementPage'
import RolePermissionsPage from './pages/admin/RolePermissionsPage'
import SystemSettingsPage from './pages/admin/SystemSettingsPage'
import AuditLogsPage from './pages/admin/AuditLogsPage'
import SmokeTestPage from './pages/admin/SmokeTestPage'
import RouteAuditPage from './pages/admin/RouteAuditPage'
import BrandManagementPage from './pages/admin/BrandManagementPage'
import CampaignManagementPage from './pages/admin/CampaignManagementPage'
import CommissionRuleBuilderPage from './pages/admin/CommissionRuleBuilderPage'
import DataImportExportPage from './pages/admin/DataImportExportPage'
import POSLibraryPage from './pages/admin/POSLibraryPage'
import ProductTypeBuilderPage from './pages/admin/ProductTypeBuilderPage'
import SurveyBuilderPage from './pages/admin/SurveyBuilderPage'
import TerritoryManagementPage from './pages/admin/TerritoryManagementPage'
import BoardManagementPage from './pages/admin/BoardManagementPage'
import PriceListManagementPage from './pages/admin/PriceListManagementPage'
import PriceListEditPage from './pages/admin/PriceListEditPage'

import { BackupManagementPage } from './pages/admin-settings/BackupManagementPage'
import { IntegrationsPage } from './pages/admin-settings/IntegrationsPage'
import { SystemHealthPage } from './pages/admin-settings/SystemHealthPage'

import InvoicesList from './pages/sales/invoices/InvoicesList'
import PaymentsList from './pages/sales/payments/PaymentsList'
import CreditNotesList from './pages/sales/credit-notes/CreditNotesList'
import SalesReturnsList from './pages/sales/returns/SalesReturnsList'
import SalesOrdersList from './pages/sales/orders/SalesOrdersList'
import VanSalesOrdersList from './pages/van-sales/orders/VanSalesOrdersList'
import VanSalesReturnsList from './pages/van-sales/returns/VanSalesReturnsList'
import VanLoadsList from './pages/van-sales/van-loads/VanLoadsList'
import VanCashReconciliationList from './pages/van-sales/cash-reconciliation/CashReconciliationList'
import AdjustmentsList from './pages/inventory/adjustments/AdjustmentsList'
import IssuesList from './pages/inventory/issues/IssuesList'
import ReceiptsList from './pages/inventory/receipts/ReceiptsList'
import StockCountsList from './pages/inventory/stock-counts/StockCountsList'
import TransfersList from './pages/inventory/transfers/TransfersList'
import CashReconciliationList from './pages/finance/cash-reconciliation/CashReconciliationList'
import CommissionPayoutsList from './pages/finance/commission-payouts/CommissionPayoutsList'
import FinanceDashboard from './pages/finance/FinanceDashboard'
import InvoiceManagementPage from './pages/finance/InvoiceManagementPage'
import PaymentCollectionPage from './pages/finance/PaymentCollectionPage'

import { CommissionApprovalPage } from './pages/commissions/CommissionApprovalPage'
import { CommissionCalculationPage } from './pages/commissions/CommissionCalculationPage'
import { CommissionDashboardPage } from './pages/commissions/CommissionDashboardPage'
import { CommissionPaymentPage } from './pages/commissions/CommissionPaymentPage'
import { CommissionReportsPage } from './pages/commissions/CommissionReportsPage'
import { CommissionSettingsPage } from './pages/commissions/CommissionSettingsPage'

import ActivationsList from './pages/marketing/activations/ActivationsList'
import CampaignsList from './pages/marketing/campaigns/CampaignsList'
import EventsList from './pages/marketing/events/EventsList'
import PromotionsList from './pages/marketing/promotions/PromotionsList'

// Field Operations List Pages
import BoardPlacementsList from './pages/field-operations/board-placements/BoardPlacementsList'
import CommissionLedgerList from './pages/field-operations/commission-ledger/CommissionLedgerList'
import ProductDistributionsList from './pages/field-operations/product-distributions/ProductDistributionsList'

import { ProductAnalyticsPage } from './pages/product-management/ProductAnalyticsPage'
import { ProductHierarchyPage } from './pages/product-management/ProductHierarchyPage'
import { ProductImportExportPage } from './pages/product-management/ProductImportExportPage'
import { ProductInventoryPage } from './pages/product-management/ProductInventoryPage'
import { ProductListPage } from './pages/product-management/ProductListPage'
import { ProductPricingPage } from './pages/product-management/ProductPricingPage'

// Inventory Management Pages

import AnalyticsDashboardPage from './pages/reports/AnalyticsDashboardPage'
import ReportBuilderPage from './pages/reports/ReportBuilderPage'
import ReportsHub from './pages/reports/ReportsHub'
import ReportTemplatesPage from './pages/reports/ReportTemplatesPage'
import CommissionSummaryReport from './pages/reports/finance/CommissionSummaryReport'
import InventorySnapshotReport from './pages/reports/inventory/InventorySnapshotReport'
import VarianceAnalysisReport from './pages/reports/inventory/VarianceAnalysisReport'
import FieldOperationsProductivityReport from './pages/reports/operations/FieldOperationsProductivityReport'
import SalesExceptionsReport from './pages/reports/sales/SalesExceptionsReport'
import SalesSummaryReport from './pages/reports/sales/SalesSummaryReport'

// KYC Surveys Pages

// Additional Dashboard Pages
import CustomerDashboard from './pages/customers/CustomerDashboard'
import OrderDashboard from './pages/orders/OrderDashboard'
import AgentDashboard from './pages/agent/AgentDashboard'
import SalesDashboard from './pages/sales/SalesDashboard'
import BrandActivationsPage from './pages/brand-activations/BrandActivationsPage'
import TenantManagement from './pages/superadmin/TenantManagement'

// Field Operations Additional Pages
import FieldAgentDashboardPage from './pages/field-operations/FieldAgentDashboardPage'
import LiveGPSTrackingPage from './pages/field-operations/LiveGPSTrackingPage'
import VisitHistoryPage from './pages/field-operations/VisitHistoryPage'
import VisitManagementPage from './pages/field-operations/VisitManagementPage'

// Van Sales Additional Pages
import VanCashCollectionPage from './pages/van-sales/VanCashCollectionPage'
import VanInventoryPage from './pages/van-sales/VanInventoryPage'
import VanOrdersListPage from './pages/van-sales/VanOrdersListPage'
import VanPerformancePage from './pages/van-sales/VanPerformancePage'
import VanRoutesListPage from './pages/van-sales/VanRoutesListPage'

// Insights Pages
import ExecutiveInsightsDashboard from './pages/insights/ExecutiveDashboard'
import SalesInsights from './pages/insights/SalesInsights'
import VanSalesInsights from './pages/insights/VanSalesInsights'
import FieldOpsInsights from './pages/insights/FieldOpsInsights'
import TradePromoInsights from './pages/insights/TradePromoInsights'
import StockInsights from './pages/insights/StockInsights'
import CommissionInsights from './pages/insights/CommissionInsights'
import GoalsInsights from './pages/insights/GoalsInsights'
import AnomalyInsights from './pages/insights/AnomalyInsights'
import ShareOfVoiceInsights from './pages/insights/ShareOfVoiceInsights'
import CompetitorInsights from './pages/insights/CompetitorInsights'
import BrandOwnerDashboard from './pages/brand-owner/BrandOwnerDashboard'
import BrandOwnerReports from './pages/brand-owner/BrandOwnerReports'

// Components
import LoadingSpinner from './components/ui/LoadingSpinner'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LandingPage from './pages/marketing/LandingPage'
import ToastContainer from './components/ui/Toast'


// BUG-007: Register previously unrouted drill-down pages
import AdjustmentItemDetail from './pages/inventory/adjustment-items/AdjustmentItemDetail'
import AdjustmentItemEdit from './pages/inventory/adjustment-items/AdjustmentItemEdit'
import AdjustmentItemList from './pages/inventory/adjustment-items/AdjustmentItemList'
import AdjustmentJustification from './pages/inventory/adjustment-items/AdjustmentJustification'
import ApprovalDetail from './pages/commissions/calculation-details/ApprovalDetail'
import BatchAllocation from './pages/inventory/batch-tracking/BatchAllocation'
import BatchDetail from './pages/inventory/batch-tracking/BatchDetail'
import BatchExpiry from './pages/inventory/batch-tracking/BatchExpiry'
import BatchMovementHistory from './pages/inventory/batch-tracking/BatchMovementHistory'
import BoardComplianceChecks from './pages/field-operations/board-management/BoardComplianceChecks'
import BoardLocationChanges from './pages/field-operations/board-management/BoardLocationChanges'
import BoardMaintenanceLog from './pages/field-operations/board-management/BoardMaintenanceLog'
import BoardPhotoHistory from './pages/field-operations/board-management/BoardPhotoHistory'
import BoardPlacementHistory from './pages/field-operations/board-management/BoardPlacementHistory'
import BrandActivationFormPage from './pages/BrandActivationFormPage'
import CalculationDetail from './pages/commissions/calculation-details/CalculationDetail'
import CalculationLog from './pages/commissions/calculation-details/CalculationLog'
import CashVariance from './pages/van-sales/cash-session-lines/CashVariance'
import CollectionDetail from './pages/van-sales/cash-session-lines/CollectionDetail'
import CountLineApproval from './pages/inventory/stock-count-lines/CountLineApproval'
import CountLineDetail from './pages/inventory/stock-count-lines/CountLineDetail'
import CountLineEdit from './pages/inventory/stock-count-lines/CountLineEdit'
import CountLineList from './pages/inventory/stock-count-lines/CountLineList'
import CustomerSelectionPage from './pages/CustomerSelectionPage'
import CustomersAdvanced from './pages/CustomersAdvanced'
import DeliveryDetail from './pages/orders/deliveries/DeliveryDetail'
import DeliveryEdit from './pages/orders/deliveries/DeliveryEdit'
import DeliveryList from './pages/orders/deliveries/DeliveryList'
import DeliveryPOD from './pages/orders/deliveries/DeliveryPOD'
import DeliveryStopDetail from './pages/orders/deliveries/DeliveryStopDetail'
import DeliveryStops from './pages/orders/deliveries/DeliveryStops'
import DepositDetail from './pages/van-sales/cash-session-lines/DepositDetail'
import ExceptionDetail from './pages/commissions/calculation-details/ExceptionDetail'
import FOBoardPlacementDetail from './pages/field-operations/visit-tasks/BoardPlacementDetail'
import FOProductDistributionDetail from './pages/field-operations/visit-tasks/ProductDistributionDetail'
import FOSurveyDetail from './pages/field-operations/visit-tasks/SurveyDetail'
import FOVisitTaskDetail from './pages/field-operations/visit-tasks/VisitTaskDetail'
import FOVisitTaskEdit from './pages/field-operations/visit-tasks/VisitTaskEdit'
import FOVisitTaskList from './pages/field-operations/visit-tasks/VisitTaskList'
import FieldMarketingAgentPage from './pages/FieldMarketingAgentPage'
import InvoiceItemDetail from './pages/finance/invoice-items/InvoiceItemDetail'
import InvoiceItemEdit from './pages/finance/invoice-items/InvoiceItemEdit'
import InvoiceItemHistory from './pages/finance/invoice-items/InvoiceItemHistory'
import InvoiceItemList from './pages/finance/invoice-items/InvoiceItemList'
import InvoiceStatusHistory from './pages/finance/invoice-status-history/InvoiceStatusHistory'
import LotDetail from './pages/inventory/batch-tracking/LotDetail'
import LotTracking from './pages/inventory/batch-tracking/LotTracking'
import MobileLoginPage from './pages/auth/MobileLoginPage'
import MovementDetail from './pages/inventory/stock-ledger/MovementDetail'
import OrderItemDetail from './pages/orders/items/OrderItemDetail'
import OrderItemEdit from './pages/orders/items/OrderItemEdit'
import OrderItemHistory from './pages/orders/items/OrderItemHistory'
import OrderItemList from './pages/orders/items/OrderItemList'
import OrderStatusHistory from './pages/orders/status-history/OrderStatusHistory'
import OrdersKanban from './pages/OrdersKanban'
import POSMaterialTrackerPage from './pages/POSMaterialTrackerPage'
import PaymentAllocationCreate from './pages/finance/payment-allocations/PaymentAllocationCreate'
import PaymentAllocationDetail from './pages/finance/payment-allocations/PaymentAllocationDetail'
import PaymentAllocationEdit from './pages/finance/payment-allocations/PaymentAllocationEdit'
import PaymentAllocationList from './pages/finance/payment-allocations/PaymentAllocationList'
import PaymentStatusHistory from './pages/finance/payment-status-history/PaymentStatusHistory'
import PayoutAuditTrail from './pages/commissions/payout-lines/PayoutAuditTrail'
import PayoutLineDetail from './pages/commissions/payout-lines/PayoutLineDetail'
import PayoutLineEdit from './pages/commissions/payout-lines/PayoutLineEdit'
import PayoutLineList from './pages/commissions/payout-lines/PayoutLineList'
import PhotoDetail from './pages/field-operations/photos/PhotoDetail'
import PhotoEvidence from './pages/field-operations/photos/PhotoEvidence'
import PhotoGallery from './pages/field-operations/photos/PhotoGallery'
import PhotoTimeline from './pages/field-operations/photos/PhotoTimeline'
import ReturnItemApproval from './pages/orders/returns-items/ReturnItemApproval'
import ReturnItemDetail from './pages/orders/returns-items/ReturnItemDetail'
import ReturnItemEdit from './pages/orders/returns-items/ReturnItemEdit'
import ReturnItemList from './pages/orders/returns-items/ReturnItemList'
import RouteStopDetail from './pages/van-sales/route-stops/RouteStopDetail'
import RouteStopEdit from './pages/van-sales/route-stops/RouteStopEdit'
import RouteStopExceptions from './pages/van-sales/route-stops/RouteStopExceptions'
import RouteStopList from './pages/van-sales/route-stops/RouteStopList'
import RouteStopPerformance from './pages/van-sales/route-stops/RouteStopPerformance'
import RuleConditionDetail from './pages/commissions/calculation-details/RuleConditionDetail'
import SKUAvailabilityCheckerPage from './pages/SKUAvailabilityCheckerPage'
import SerialDetail from './pages/inventory/batch-tracking/SerialDetail'
import SerialTracking from './pages/inventory/batch-tracking/SerialTracking'
import ShelfAnalyticsFormPage from './pages/ShelfAnalyticsFormPage'
import SourceTransactions from './pages/commissions/payout-lines/SourceTransactions'
import StatusTransitionDetail from './pages/orders/status-history/StatusTransitionDetail'
import StockLedgerByProduct from './pages/inventory/stock-ledger/StockLedgerByProduct'
import StockLedgerByWarehouse from './pages/inventory/stock-ledger/StockLedgerByWarehouse'
import StockLedgerDetail from './pages/inventory/stock-ledger/StockLedgerDetail'
import SurveyAnalysis from './pages/field-operations/survey-responses/SurveyAnalysis'
import SurveyAnswerDetail from './pages/field-operations/survey-responses/SurveyAnswerDetail'
import SurveyComparison from './pages/field-operations/survey-responses/SurveyComparison'
import SurveyResponseDetail from './pages/field-operations/survey-responses/SurveyResponseDetail'
import SurveyResponseEdit from './pages/field-operations/survey-responses/SurveyResponseEdit'
import TradeMarketingAgentPage from './pages/TradeMarketingAgentPage'
import TransferItemDetail from './pages/inventory/transfer-items/TransferItemDetail'
import TransferItemEdit from './pages/inventory/transfer-items/TransferItemEdit'
import TransferItemList from './pages/inventory/transfer-items/TransferItemList'
import TransferItemTracking from './pages/inventory/transfer-items/TransferItemTracking'
import VanLoadItemDetail from './pages/van-sales/van-load-items/VanLoadItemDetail'
import VanLoadItemEdit from './pages/van-sales/van-load-items/VanLoadItemEdit'
import VanLoadItemList from './pages/van-sales/van-load-items/VanLoadItemList'
import VanLoadReconciliation from './pages/van-sales/van-load-items/VanLoadReconciliation'
import VanLoadVariance from './pages/van-sales/van-load-items/VanLoadVariance'
import VarianceResolution from './pages/inventory/stock-count-lines/VarianceResolution'
import VisitWorkflowPage from './pages/VisitWorkflowPage'
import VisitsList from './pages/field-operations/visits/VisitsList'

function App() {
  const { isAuthenticated, isLoading, initialize, hydrated } = useAuthStore()

  useEffect(() => {
    if (hydrated) {
      initialize()
    }
  }, [hydrated, initialize])

  if (!hydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06090F]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <ToastContainer />
      <div className="min-h-screen bg-[#06090F]">
        <Routes>
          {/* Marketing Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Public Routes */}
          <Route path="/auth/*" element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthLayout />
          }>
            <Route path="login" element={<LoginPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="mobile-login" element={<MobileLoginPage />} />
            <Route index element={<Navigate to="login" replace />} />
          </Route>

          {/* Protected Routes - using pathless parent to avoid catch-all matching "/" */}
          <Route element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            {/* Dashboard Routes */}
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            
            <Route path="analytics-dashboard/*" element={<Navigate to="/insights" replace />} />
            
                        {/* Reports Routes */}
                        <Route path="reports" element={<ReportsHub />} />
                        <Route path="reports/hub" element={<ReportsHub />} />
                        <Route path="reports/builder" element={<ReportBuilderPage />} />
            <Route path="reports/templates" element={<ReportTemplatesPage />} />
            <Route path="reports/create" element={<ReportCreate />} />
            <Route path="reports/:id" element={<ReportDetail />} />
            <Route path="reports/:id/edit" element={<ReportEdit />} />
            <Route path="reports/sales/summary" element={<SalesSummaryReport />} />
            <Route path="reports/sales/exceptions" element={<SalesExceptionsReport />} />
            <Route path="reports/finance/commission-summary" element={<CommissionSummaryReport />} />
            <Route path="reports/inventory/snapshot" element={<InventorySnapshotReport />} />
            <Route path="reports/inventory/variance" element={<VarianceAnalysisReport />} />
            <Route path="reports/operations/field-ops-productivity" element={<FieldOperationsProductivityReport />} />
            
            <Route path="reports-analytics/*" element={<Navigate to="/reports" replace />} />

            {/* Van Sales Routes */}
            <Route path="van-sales" element={<VanSalesDashboard />} />
            <Route path="van-sales/dashboard" element={<VanSalesDashboard />} />
            <Route path="van-sales/workflow" element={<VanSalesWorkflowPageMobile />} />
            <Route path="van-sales/management" element={<VanSalesPage />} />
            <Route path="van-sales/performance" element={<VanPerformancePage />} />
            <Route path="van-sales/cash-collection" element={<VanCashCollectionPage />} />
            <Route path="van-sales/van-inventory" element={<VanInventoryPage />} />
            <Route path="van-sales/routes" element={<VanRoutesListPage />} />
            <Route path="van-sales/routes/create" element={<RouteCreate />} />
            <Route path="van-sales/routes/:id" element={<RouteDetail />} />
            <Route path="van-sales/routes/:id/edit" element={<RouteEdit />} />
            <Route path="van-sales/routes/:id/customers" element={<RouteCustomers />} />
            <Route path="van-sales/routes/:id/orders" element={<RouteOrders />} />
            <Route path="van-sales/routes/:id/performance" element={<RoutePerformance />} />
            <Route path="van-sales/inventory" element={<InventoryTrackingPage />} />
            <Route path="van-sales/orders" element={<VanSalesOrdersList />} />
            <Route path="van-sales/orders/create" element={<VanOrderCreatePage />} />
            <Route path="van-sales/orders/new" element={<VanSalesOrderCreate />} />
            <Route path="van-sales/orders/:id" element={<VanSalesOrderDetail />} />
            <Route path="van-sales/orders/:id/edit" element={<VanSalesOrderEdit />} />
            <Route path="van-sales/returns" element={<VanSalesReturnsList />} />
            <Route path="van-sales/returns/create" element={<VanSalesReturnCreate />} />
            <Route path="van-sales/returns/:id" element={<VanSalesReturnDetail />} />
            <Route path="van-sales/van-loads" element={<VanLoadsList />} />
            <Route path="van-sales/van-loads/create" element={<VanLoadCreate />} />
            <Route path="van-sales/van-loads/:id" element={<VanLoadDetail />} />
            <Route path="van-sales/cash-reconciliation" element={<VanCashReconciliationList />} />
            <Route path="van-sales/cash-reconciliation/create" element={<VanCashReconciliationCreate />} />
            <Route path="van-sales/cash-reconciliation/:id" element={<VanCashReconciliationDetail />} />

            {/* Field Operations Routes */}
            <Route path="field-operations" element={<FieldOperationsDashboard />} />
            <Route path="field-operations/dashboard" element={<FieldOperationsDashboard />} />
            <Route path="field-operations/agent-dashboard" element={<FieldAgentDashboardPage />} />
            <Route path="field-operations/agents" element={<FieldAgentsPage />} />
            <Route path="field-operations/mapping" element={<LiveMappingPage />} />
            <Route path="field-operations/gps-tracking" element={<LiveGPSTrackingPage />} />
            <Route path="field-operations/boards" element={<BoardPlacementsList />} />
            <Route path="field-operations/boards/create" element={<BoardPlacementFormPage />} />
            <Route path="field-operations/boards/:id" element={<BoardPlacementDetail />} />
            <Route path="field-operations/products" element={<ProductDistributionsList />} />
            <Route path="field-operations/products/create" element={<ProductDistributionFormPage />} />
            <Route path="field-operations/products/:id" element={<ProductDistributionDetail />} />
            <Route path="field-operations/commission" element={<CommissionLedgerList />} />
            <Route path="field-operations/commission/:id" element={<CommissionLedgerDetail />} />
            <Route path="field-operations/visits" element={<VisitManagementPage />} />
            <Route path="field-operations/visits/create" element={<VisitCreate />} />
            <Route path="field-operations/visits/:id" element={<VisitDetail />} />
            <Route path="field-operations/visits/:id/edit" element={<VisitEdit />} />
            <Route path="field-operations/visit-configurations" element={<VisitConfigurationPage />} />
            <Route path="field-operations/visit-history" element={<VisitHistoryPage />} />
            <Route path="field-operations/visit-management" element={<VisitManagementPage />} />

            <Route path="field-marketing/*" element={<Navigate to="/field-operations" replace />} />

            {/* KYC Routes */}
            <Route path="kyc" element={<KYCDashboard />} />
            <Route path="kyc/dashboard" element={<KYCDashboard />} />
            <Route path="kyc/management" element={<KYCManagement />} />
            <Route path="kyc/create" element={<KYCCreate />} />
            <Route path="kyc/:id" element={<KYCDetail />} />
            <Route path="kyc/:id/edit" element={<KYCEdit />} />
            <Route path="kyc/reports" element={<KYCReports />} />
            
            <Route path="kyc-surveys/*" element={<Navigate to="/kyc" replace />} />

            {/* Surveys Routes */}
            <Route path="surveys" element={<SurveysDashboard />} />
            <Route path="surveys/dashboard" element={<SurveysDashboard />} />
            <Route path="surveys/management" element={<SurveysManagement />} />
            <Route path="surveys/create" element={<SurveyCreate />} />
            <Route path="surveys/:id/edit" element={<SurveyEdit />} />
            <Route path="surveys/:id/responses" element={<SurveyResponses />} />
            <Route path="surveys/:id/analytics" element={<SurveyAnalytics />} />

            {/* Inventory Routes */}
            <Route path="inventory" element={<InventoryDashboard />} />
            <Route path="inventory/dashboard" element={<InventoryDashboard />} />
            <Route path="inventory/stock-count" element={<StockCountWorkflowPage />} />
            <Route path="inventory/stock-count/:id" element={<StockCountDetail />} />
            <Route path="inventory/management" element={<InventoryManagement />} />
            <Route path="inventory/reports" element={<InventoryReports />} />
            <Route path="inventory/adjustments" element={<AdjustmentsList />} />
            <Route path="inventory/adjustments/create" element={<AdjustmentCreate />} />
            <Route path="inventory/adjustments/:id" element={<AdjustmentDetail />} />
            <Route path="inventory/issues" element={<IssuesList />} />
            <Route path="inventory/issues/create" element={<IssueCreate />} />
            <Route path="inventory/issues/:id" element={<IssueDetail />} />
            <Route path="inventory/receipts" element={<ReceiptsList />} />
            <Route path="inventory/receipts/create" element={<ReceiptCreate />} />
            <Route path="inventory/receipts/:id" element={<ReceiptDetail />} />
            <Route path="inventory/stock-counts" element={<StockCountsList />} />
            <Route path="inventory/stock-counts/create" element={<StockCountCreate />} />
            <Route path="inventory/stock-counts/:id" element={<StockCountDetail />} />
            <Route path="inventory/transfers" element={<TransfersList />} />
            <Route path="inventory/transfers/create" element={<TransferCreate />} />
            <Route path="inventory/transfers/:id" element={<TransferDetail />} />
            
            <Route path="inventory-management/*" element={<Navigate to="/inventory" replace />} />

            {/* Promotions Routes */}
            <Route path="promotions" element={<PromotionsDashboard />} />
            <Route path="promotions/dashboard" element={<PromotionsDashboard />} />
            <Route path="promotions/management" element={<PromotionsManagement />} />

            {/* Trade Marketing Routes */}
            <Route path="trade-marketing" element={<TradeMarketingPage />} />
            <Route path="trade-marketing/activation" element={<ActivationWorkflowPage />} />
            <Route path="trade-marketing/campaigns" element={<CampaignManagementPage />} />
            <Route path="trade-marketing/merchandising" element={<MerchandisingCompliancePage />} />
            <Route path="trade-marketing/promoters" element={<PromoterManagementPage />} />
            <Route path="trade-marketing/analytics" element={<TradeMarketingAnalyticsPage />} />

            {/* Events Routes */}
            <Route path="events" element={<EventsPage />} />

            {/* Campaign Routes */}
            <Route path="campaigns" element={<CampaignsPage />} />
            
            {/* Brand Activations Routes */}
            <Route path="brand-activations" element={<BrandActivationsPage />} />
            
            {/* Superadmin Routes */}
            <Route path="superadmin/tenants" element={<TenantManagement />} />

            <Route path="field-agents/*" element={<Navigate to="/field-operations" replace />} />

            {/* Business Routes */}
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/dashboard" element={<CustomerDashboard />} />
            <Route path="customers/create" element={<CustomerCreatePage />} />
            <Route path="customers/:id" element={<CustomerDetailsPage />} />
            <Route path="customers/:id/edit" element={<CustomerEditPage />} />
            <Route path="customers/:id/orders" element={<CustomerOrders />} />
            <Route path="customers/:id/visits" element={<CustomerVisits />} />
            <Route path="customers/:id/payments" element={<CustomerPayments />} />
            <Route path="customers/:id/surveys" element={<CustomerSurveys />} />
            <Route path="customers/:id/kyc" element={<CustomerKYC />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/dashboard" element={<OrderDashboard />} />
            <Route path="orders/create" element={<OrderCreatePage />} />
            <Route path="orders/:id" element={<OrderDetailsPage />} />
            <Route path="orders/:id/edit" element={<OrderEditPage />} />
            <Route path="orders/:id/items" element={<OrderItems />} />
            <Route path="orders/:id/payments" element={<OrderPayments />} />
            <Route path="orders/:id/delivery" element={<OrderDelivery />} />
            <Route path="orders/:id/returns" element={<OrderReturns />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/create" element={<ProductCreatePage />} />
            <Route path="products/:id" element={<ProductDetailsPage />} />
            <Route path="products/:id/edit" element={<ProductEditPage />} />
            <Route path="products/:id/inventory" element={<ProductInventory />} />
            <Route path="products/:id/pricing" element={<ProductPricing />} />
            <Route path="products/:id/promotions" element={<ProductPromotions />} />
            <Route path="products/:id/sales" element={<ProductSales />} />
            <Route path="brands" element={<BrandsList />} />
            <Route path="brands/create" element={<BrandCreate />} />
            <Route path="brands/:id" element={<BrandDetail />} />
            <Route path="brands/:id/edit" element={<BrandEdit />} />
            <Route path="brands/:id/surveys" element={<BrandSurveys />} />
            <Route path="brands/:id/activations" element={<BrandActivations />} />
            <Route path="brands/:id/boards" element={<BrandBoards />} />
            <Route path="brands/:id/products" element={<BrandProducts />} />
            
            <Route path="customer-management/*" element={<Navigate to="/customers" replace />} />
            
            {/* Product Management Routes */}
            <Route path="product-management/list" element={<ProductListPage />} />
            <Route path="product-management/analytics" element={<ProductAnalyticsPage />} />
            <Route path="product-management/hierarchy" element={<ProductHierarchyPage />} />
            <Route path="product-management/import-export" element={<ProductImportExportPage />} />
            <Route path="product-management/inventory" element={<ProductInventoryPage />} />
            <Route path="product-management/pricing" element={<ProductPricingPage />} />
            
            <Route path="order-lifecycle/*" element={<Navigate to="/sales" replace />} />

            {/* Sales Routes */}
            <Route path="sales" element={<SalesDashboard />} />
            <Route path="sales/orders" element={<SalesOrdersList />} />
            <Route path="sales/orders/create" element={<SalesOrderCreate />} />
            <Route path="sales/orders/:id" element={<SalesOrderDetail />} />
            <Route path="sales/orders/:id/edit" element={<SalesOrderEdit />} />
            <Route path="sales/invoices" element={<InvoicesList />} />
            <Route path="sales/invoices/create" element={<InvoiceCreate />} />
            <Route path="sales/invoices/:id" element={<InvoiceDetail />} />
            <Route path="sales/payments" element={<PaymentsList />} />
            <Route path="sales/payments/create" element={<PaymentCreate />} />
            <Route path="sales/payments/:id" element={<PaymentDetail />} />
            <Route path="sales/credit-notes" element={<CreditNotesList />} />
            <Route path="sales/credit-notes/create" element={<CreditNoteCreate />} />
            <Route path="sales/credit-notes/:id" element={<CreditNoteDetail />} />
            <Route path="sales/returns" element={<SalesReturnsList />} />
            <Route path="sales/returns/create" element={<SalesReturnCreate />} />
            <Route path="sales/returns/:id" element={<SalesReturnDetail />} />

            {/* Marketing Routes */}
            <Route path="marketing/campaigns" element={<CampaignsList />} />
            <Route path="marketing/campaigns/create" element={<CampaignCreate />} />
            <Route path="marketing/campaigns/:id" element={<CampaignDetail />} />
            <Route path="marketing/campaigns/:id/edit" element={<CampaignEdit />} />
            <Route path="marketing/events" element={<EventsList />} />
            <Route path="marketing/events/create" element={<EventCreate />} />
            <Route path="marketing/events/:id" element={<EventDetail />} />
            <Route path="marketing/events/:id/edit" element={<EventEdit />} />
            <Route path="marketing/activations" element={<ActivationsList />} />
            <Route path="marketing/activations/create" element={<ActivationCreate />} />
            <Route path="marketing/activations/:id" element={<ActivationDetail />} />
            <Route path="marketing/promotions" element={<PromotionsList />} />
            <Route path="marketing/promotions/create" element={<PromotionCreate />} />
            <Route path="marketing/promotions/:id" element={<PromotionDetail />} />

            <Route path="crm/*" element={<Navigate to="/customers" replace />} />

            {/* Finance Routes */}
            <Route path="finance" element={<FinanceDashboard />} />
            <Route path="finance/invoices" element={<InvoiceManagementPage />} />
            <Route path="finance/invoices/create" element={<FinanceInvoiceCreate />} />
            <Route path="finance/invoices/:id" element={<FinanceInvoiceDetail />} />
            <Route path="finance/invoices/:id/edit" element={<FinanceInvoiceEdit />} />
            <Route path="finance/invoices/:id/payments" element={<InvoicePayments />} />
            <Route path="finance/invoices/:id/items" element={<InvoiceItems />} />
            <Route path="finance/payments" element={<PaymentCollectionPage />} />
            <Route path="finance/payments/create" element={<FinancePaymentCreate />} />
            <Route path="finance/payments/:id" element={<FinancePaymentDetail />} />
            <Route path="finance/payments/:id/edit" element={<FinancePaymentEdit />} />
            <Route path="finance/cash-reconciliation" element={<CashReconciliationList />} />
            <Route path="finance/cash-reconciliation/create" element={<CashReconciliationCreate />} />
            <Route path="finance/cash-reconciliation/:id" element={<CashReconciliationDetail />} />
            <Route path="finance/commission-payouts" element={<CommissionPayoutsList />} />
            <Route path="finance/commission-payouts/:id" element={<CommissionPayoutDetail />} />
            
            <Route path="cash-reconciliation/*" element={<Navigate to="/finance/cash-reconciliation" replace />} />
            
            {/* Commission Routes */}
            <Route path="commissions" element={<CommissionDashboardPage />} />
            <Route path="commissions/create" element={<CommissionCreate />} />
            <Route path="commissions/:id" element={<CommissionDetail />} />
            <Route path="commissions/:id/edit" element={<CommissionEdit />} />
            <Route path="commissions/calculation" element={<CommissionCalculationPage />} />
            <Route path="commissions/approval" element={<CommissionApprovalPage />} />
            <Route path="commissions/payment" element={<CommissionPaymentPage />} />
            <Route path="commissions/reports" element={<CommissionReportsPage />} />
            <Route path="commissions/settings" element={<CommissionSettingsPage />} />
            <Route path="commissions/rules/create" element={<RuleCreate />} />
            <Route path="commissions/rules/:id" element={<RuleDetail />} />
            <Route path="commissions/rules/:id/edit" element={<RuleEdit />} />

            {/* Admin Routes */}
            <Route path="admin" element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            } />
            <Route path="admin/dashboard" element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="admin/users" element={
              <ProtectedRoute requiredRole="admin">
                <UserManagementPage />
              </ProtectedRoute>
            } />
            <Route path="admin/roles" element={
              <ProtectedRoute requiredRole="admin">
                <RolePermissionsPage />
              </ProtectedRoute>
            } />
            <Route path="admin/settings" element={
              <ProtectedRoute requiredRole="admin">
                <SystemSettingsPage />
              </ProtectedRoute>
            } />
            <Route path="admin/audit" element={
              <ProtectedRoute requiredRole="admin">
                <AuditLogsPage />
              </ProtectedRoute>
            } />
            <Route path="admin/brands" element={
              <ProtectedRoute requiredRole="admin">
                <BrandManagementPage />
              </ProtectedRoute>
            } />
            <Route path="admin/campaigns" element={
              <ProtectedRoute requiredRole="admin">
                <CampaignManagementPage />
              </ProtectedRoute>
            } />
            <Route path="admin/commissions" element={
              <ProtectedRoute requiredRole="admin">
                <CommissionRuleBuilderPage />
              </ProtectedRoute>
            } />
            <Route path="admin/data-import-export" element={
              <ProtectedRoute requiredRole="admin">
                <DataImportExportPage />
              </ProtectedRoute>
            } />
            <Route path="admin/pos-library" element={
              <ProtectedRoute requiredRole="admin">
                <POSLibraryPage />
              </ProtectedRoute>
            } />
            <Route path="admin/product-types" element={
              <ProtectedRoute requiredRole="admin">
                <ProductTypeBuilderPage />
              </ProtectedRoute>
            } />
            <Route path="admin/surveys" element={
              <ProtectedRoute requiredRole="admin">
                <SurveyBuilderPage />
              </ProtectedRoute>
            } />
            <Route path="admin/territories" element={
              <ProtectedRoute requiredRole="admin">
                <TerritoryManagementPage />
              </ProtectedRoute>
            } />
            <Route path="admin/boards" element={
              <ProtectedRoute requiredRole="admin">
                <BoardManagementPage />
              </ProtectedRoute>
            } />
            <Route path="admin/backup" element={
              <ProtectedRoute requiredRole="admin">
                <BackupManagementPage />
              </ProtectedRoute>
            } />
            <Route path="admin/integrations" element={
              <ProtectedRoute requiredRole="admin">
                <IntegrationsPage />
              </ProtectedRoute>
            } />
            <Route path="admin/system-health" element={
              <ProtectedRoute requiredRole="admin">
                <SystemHealthPage />
              </ProtectedRoute>
            } />
            <Route path="admin/smoke-test" element={
              <ProtectedRoute requiredRole="admin">
                <SmokeTestPage />
              </ProtectedRoute>
            } />
            <Route path="admin/route-audit" element={
              <ProtectedRoute requiredRole="admin">
                <RouteAuditPage />
              </ProtectedRoute>
            } />
            <Route path="admin/price-lists" element={
              <ProtectedRoute requiredRole="admin">
                <PriceListManagementPage />
              </ProtectedRoute>
            } />
            <Route path="admin/price-lists/:id" element={
              <ProtectedRoute requiredRole="admin">
                <PriceListEditPage />
              </ProtectedRoute>
            } />

            {/* Insights Dashboard Routes */}
            <Route path="insights" element={<ExecutiveInsightsDashboard />} />
            <Route path="insights/executive" element={<ExecutiveInsightsDashboard />} />
            <Route path="insights/sales" element={<SalesInsights />} />
            <Route path="insights/van-sales" element={<VanSalesInsights />} />
            <Route path="insights/field-ops" element={<FieldOpsInsights />} />
            <Route path="insights/trade-promotions" element={<TradePromoInsights />} />
            <Route path="insights/stock" element={<StockInsights />} />
            <Route path="insights/commissions" element={<CommissionInsights />} />
            <Route path="insights/goals" element={<GoalsInsights />} />
            <Route path="insights/anomalies" element={<AnomalyInsights />} />
            <Route path="insights/share-of-voice" element={<ShareOfVoiceInsights />} />
            <Route path="insights/competitors" element={<CompetitorInsights />} />
            <Route path="brand-owner/dashboard" element={<BrandOwnerDashboard />} />
            <Route path="brand-owner/reports" element={<BrandOwnerReports />} />


            {/* BUG-007: Previously unrouted drill-down pages */}
            <Route path="inventory/adjustments/:id/items/:itemId" element={<AdjustmentItemDetail />} />
            <Route path="inventory/adjustments/:id/items/:itemId/edit" element={<AdjustmentItemEdit />} />
            <Route path="inventory/adjustments/:id/items" element={<AdjustmentItemList />} />
            <Route path="inventory/adjustments/:id/justification" element={<AdjustmentJustification />} />
            <Route path="commissions/approvals/:id" element={<ApprovalDetail />} />
            <Route path="inventory/batches/:id/allocation" element={<BatchAllocation />} />
            <Route path="inventory/batches/:id" element={<BatchDetail />} />
            <Route path="inventory/batches/expiry" element={<BatchExpiry />} />
            <Route path="inventory/batches/:id/movements" element={<BatchMovementHistory />} />
            <Route path="field-operations/boards/:id/compliance" element={<BoardComplianceChecks />} />
            <Route path="field-operations/boards/:id/location-changes" element={<BoardLocationChanges />} />
            <Route path="field-operations/boards/:id/maintenance" element={<BoardMaintenanceLog />} />
            <Route path="field-operations/boards/:id/photos" element={<BoardPhotoHistory />} />
            <Route path="field-operations/boards/:id/history" element={<BoardPlacementHistory />} />
            <Route path="field-operations/brand-activation" element={<BrandActivationFormPage />} />
            <Route path="commissions/calculations/:id" element={<CalculationDetail />} />
            <Route path="commissions/calculations/:id/log" element={<CalculationLog />} />
            <Route path="van-sales/cash-reconciliation/:sessionId/variance" element={<CashVariance />} />
            <Route path="van-sales/cash-reconciliation/:sessionId/collections/:collectionId" element={<CollectionDetail />} />
            <Route path="inventory/stock-counts/:countId/lines/:lineId/approval" element={<CountLineApproval />} />
            <Route path="inventory/stock-counts/:countId/lines/:lineId" element={<CountLineDetail />} />
            <Route path="inventory/stock-counts/:countId/lines/:lineId/edit" element={<CountLineEdit />} />
            <Route path="inventory/stock-counts/:countId/lines" element={<CountLineList />} />
            <Route path="customer-selection" element={<CustomerSelectionPage />} />
            <Route path="customers/advanced" element={<CustomersAdvanced />} />
            <Route path="orders/:id/deliveries/:deliveryId" element={<DeliveryDetail />} />
            <Route path="orders/:id/deliveries/:deliveryId/edit" element={<DeliveryEdit />} />
            <Route path="orders/:id/deliveries" element={<DeliveryList />} />
            <Route path="orders/:id/deliveries/:deliveryId/pod" element={<DeliveryPOD />} />
            <Route path="orders/:id/deliveries/:deliveryId/stops/:stopId" element={<DeliveryStopDetail />} />
            <Route path="orders/:id/deliveries/:deliveryId/stops" element={<DeliveryStops />} />
            <Route path="van-sales/cash-reconciliation/:sessionId/deposits/:depositId" element={<DepositDetail />} />
            <Route path="commissions/exceptions/:id" element={<ExceptionDetail />} />
            <Route path="field-operations/visits/:id/board-placement" element={<FOBoardPlacementDetail />} />
            <Route path="field-operations/visits/:id/product-distribution" element={<FOProductDistributionDetail />} />
            <Route path="field-operations/visits/:id/survey" element={<FOSurveyDetail />} />
            <Route path="field-operations/visits/:id/tasks/:taskId" element={<FOVisitTaskDetail />} />
            <Route path="field-operations/visits/:id/tasks/:taskId/edit" element={<FOVisitTaskEdit />} />
            <Route path="field-operations/visits/:id/tasks" element={<FOVisitTaskList />} />
            <Route path="field-marketing/agent" element={<FieldMarketingAgentPage />} />
            <Route path="finance/invoices/:invoiceId/items/:itemId" element={<InvoiceItemDetail />} />
            <Route path="finance/invoices/:invoiceId/items/:itemId/edit" element={<InvoiceItemEdit />} />
            <Route path="finance/invoices/:invoiceId/items/:itemId/history" element={<InvoiceItemHistory />} />
            <Route path="finance/invoices/:invoiceId/items-list" element={<InvoiceItemList />} />
            <Route path="finance/invoices/:invoiceId/status-history" element={<InvoiceStatusHistory />} />
            <Route path="inventory/lots/:id" element={<LotDetail />} />
            <Route path="inventory/lots" element={<LotTracking />} />
            <Route path="inventory/stock-ledger/movements/:id" element={<MovementDetail />} />
            <Route path="orders/:id/items/:itemId" element={<OrderItemDetail />} />
            <Route path="orders/:id/items/:itemId/edit" element={<OrderItemEdit />} />
            <Route path="orders/:id/items/:itemId/history" element={<OrderItemHistory />} />
            <Route path="orders/:id/items-list" element={<OrderItemList />} />
            <Route path="orders/:id/status-history" element={<OrderStatusHistory />} />
            <Route path="orders/kanban" element={<OrdersKanban />} />
            <Route path="field-operations/pos-tracker" element={<POSMaterialTrackerPage />} />
            <Route path="finance/payments/:paymentId/allocations/create" element={<PaymentAllocationCreate />} />
            <Route path="finance/payments/:paymentId/allocations/:allocId" element={<PaymentAllocationDetail />} />
            <Route path="finance/payments/:paymentId/allocations/:allocId/edit" element={<PaymentAllocationEdit />} />
            <Route path="finance/payments/:paymentId/allocations" element={<PaymentAllocationList />} />
            <Route path="finance/payments/:paymentId/status-history" element={<PaymentStatusHistory />} />
            <Route path="commissions/payouts/:payoutId/audit" element={<PayoutAuditTrail />} />
            <Route path="commissions/payouts/:payoutId/lines/:lineId" element={<PayoutLineDetail />} />
            <Route path="commissions/payouts/:payoutId/lines/:lineId/edit" element={<PayoutLineEdit />} />
            <Route path="commissions/payouts/:payoutId/lines" element={<PayoutLineList />} />
            <Route path="field-operations/photos/:id" element={<PhotoDetail />} />
            <Route path="field-operations/photos/:id/evidence" element={<PhotoEvidence />} />
            <Route path="field-operations/photos" element={<PhotoGallery />} />
            <Route path="field-operations/photos/timeline" element={<PhotoTimeline />} />
            <Route path="orders/:id/return-items/:itemId/approval" element={<ReturnItemApproval />} />
            <Route path="orders/:id/return-items/:itemId" element={<ReturnItemDetail />} />
            <Route path="orders/:id/return-items/:itemId/edit" element={<ReturnItemEdit />} />
            <Route path="orders/:id/return-items" element={<ReturnItemList />} />
            <Route path="van-sales/routes/:routeId/stops/:stopId" element={<RouteStopDetail />} />
            <Route path="van-sales/routes/:routeId/stops/:stopId/edit" element={<RouteStopEdit />} />
            <Route path="van-sales/routes/:routeId/stops/exceptions" element={<RouteStopExceptions />} />
            <Route path="van-sales/routes/:routeId/stops" element={<RouteStopList />} />
            <Route path="van-sales/routes/:routeId/stops/performance" element={<RouteStopPerformance />} />
            <Route path="commissions/rules/:id/conditions" element={<RuleConditionDetail />} />
            <Route path="field-operations/sku-checker" element={<SKUAvailabilityCheckerPage />} />
            <Route path="inventory/serials/:id" element={<SerialDetail />} />
            <Route path="inventory/serials" element={<SerialTracking />} />
            <Route path="field-operations/shelf-analytics" element={<ShelfAnalyticsFormPage />} />
            <Route path="commissions/payouts/:payoutId/transactions" element={<SourceTransactions />} />
            <Route path="orders/:id/status-history/:transitionId" element={<StatusTransitionDetail />} />
            <Route path="inventory/stock-ledger/by-product" element={<StockLedgerByProduct />} />
            <Route path="inventory/stock-ledger/by-warehouse" element={<StockLedgerByWarehouse />} />
            <Route path="inventory/stock-ledger" element={<StockLedgerDetail />} />
            <Route path="field-operations/surveys/:id/analysis" element={<SurveyAnalysis />} />
            <Route path="field-operations/surveys/:id/answers/:answerId" element={<SurveyAnswerDetail />} />
            <Route path="field-operations/surveys/comparison" element={<SurveyComparison />} />
            <Route path="field-operations/surveys/:id/responses/:responseId" element={<SurveyResponseDetail />} />
            <Route path="field-operations/surveys/:id/responses/:responseId/edit" element={<SurveyResponseEdit />} />
            <Route path="trade-marketing/agent" element={<TradeMarketingAgentPage />} />
            <Route path="inventory/transfers/:id/items/:itemId" element={<TransferItemDetail />} />
            <Route path="inventory/transfers/:id/items/:itemId/edit" element={<TransferItemEdit />} />
            <Route path="inventory/transfers/:id/items" element={<TransferItemList />} />
            <Route path="inventory/transfers/:id/tracking" element={<TransferItemTracking />} />
            <Route path="van-sales/van-loads/:loadId/items/:itemId" element={<VanLoadItemDetail />} />
            <Route path="van-sales/van-loads/:loadId/items/:itemId/edit" element={<VanLoadItemEdit />} />
            <Route path="van-sales/van-loads/:loadId/items" element={<VanLoadItemList />} />
            <Route path="van-sales/van-loads/:loadId/reconciliation" element={<VanLoadReconciliation />} />
            <Route path="van-sales/van-loads/:loadId/variance" element={<VanLoadVariance />} />
            <Route path="inventory/stock-counts/:countId/variance" element={<VarianceResolution />} />
            <Route path="field-operations/visit-workflow" element={<VisitWorkflowPage />} />
            <Route path="field-operations/visits/list" element={<VisitsList />} />

            {/* Default redirect */}
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={
            isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <Navigate to="/auth/login" replace />
          } />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}

export default App
