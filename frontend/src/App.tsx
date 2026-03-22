import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'
import { lazy, Suspense, useEffect, type ComponentType } from 'react'

// Layout Components (eager - needed immediately)
import AuthLayout from './components/layout/AuthLayout'
import DashboardLayout from './components/layout/DashboardLayout'
import ErrorBoundary from './components/ui/ErrorBoundary'
import LoadingSpinner from './components/ui/LoadingSpinner'
import ProtectedRoute from './components/auth/ProtectedRoute'
import ToastContainer from './components/ui/Toast'

// T-17: NotFoundPage
import NotFoundPage from './pages/NotFoundPage'

// Chunk load error recovery: when deploying new code, old cached chunks may 404.
// This wrapper retries the import and forces a page reload if chunks are stale.
function lazyWithRetry(importFn: () => Promise<{ default: ComponentType<unknown> }>) {
  return lazy(() =>
    importFn().catch((error: Error) => {
      // Only auto-reload once to avoid infinite loops
      const hasReloaded = sessionStorage.getItem('chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
        // Return a never-resolving promise to keep Suspense spinner visible until reload completes
        return new Promise(() => {});
      }
      throw error;
    })
  );
}

// T-15: All page components loaded via React.lazy for code splitting
const ActivationCreate = lazyWithRetry(() => import('./pages/marketing/activations/ActivationCreate'))
const MarketingHierarchyPage = lazyWithRetry(() => import('./pages/marketing/MarketingHierarchyPage'))
const ActivationDetail = lazyWithRetry(() => import('./pages/marketing/activations/ActivationDetail'))
const ActivationWorkflowPage = lazyWithRetry(() => import('./pages/trade-marketing/ActivationWorkflowPage'))
const ActivationsList = lazyWithRetry(() => import('./pages/marketing/activations/ActivationsList'))
const AdjustmentCreate = lazyWithRetry(() => import('./pages/inventory/adjustments/AdjustmentCreate'))
const AdjustmentDetail = lazyWithRetry(() => import('./pages/inventory/adjustments/AdjustmentDetail'))
const AdjustmentItemDetail = lazyWithRetry(() => import('./pages/inventory/adjustment-items/AdjustmentItemDetail'))
const AdjustmentItemEdit = lazyWithRetry(() => import('./pages/inventory/adjustment-items/AdjustmentItemEdit'))
const AdjustmentItemList = lazyWithRetry(() => import('./pages/inventory/adjustment-items/AdjustmentItemList'))
const AdjustmentJustification = lazyWithRetry(() => import('./pages/inventory/adjustment-items/AdjustmentJustification'))
const AdjustmentsList = lazyWithRetry(() => import('./pages/inventory/adjustments/AdjustmentsList'))
const AdminCampaignManagementPage = lazyWithRetry(() => import('./pages/admin/CampaignManagementPage'))
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'))
const AdminPage = lazyWithRetry(() => import('./pages/admin/AdminPage'))
const AgentDashboard = lazyWithRetry(() => import('./pages/agent/AgentDashboard'))
const AgentLayout = lazyWithRetry(() => import('./pages/agent/AgentLayout'))
const AgentVisits = lazyWithRetry(() => import('./pages/agent/AgentVisits'))
const AgentStats = lazyWithRetry(() => import('./pages/agent/AgentStats'))
const AgentProfile = lazyWithRetry(() => import('./pages/agent/AgentProfile'))
const AgentOnboarding = lazyWithRetry(() => import('./pages/agent/AgentOnboarding'))
const AgentPinManagement = lazyWithRetry(() => import('./pages/agent/AgentPinManagement'))
const AgentTrainingGuide = lazyWithRetry(() => import('./pages/agent/AgentTrainingGuide'))
const TeamTab = lazyWithRetry(() => import('./pages/agent/TeamTab'))
const ManagerTeamsTab = lazyWithRetry(() => import('./pages/agent/ManagerTeamsTab'))
const AgentHierarchyPage = lazyWithRetry(() => import('./pages/field-operations/AgentHierarchyPage'))
const AnalyticsDashboardPage = lazyWithRetry(() => import('./pages/reports/AnalyticsDashboardPage'))
const AnalyticsPage = lazyWithRetry(() => import('./pages/dashboard/AnalyticsPage'))
const AnomalyInsights = lazyWithRetry(() => import('./pages/insights/AnomalyInsights'))
const ApprovalDetail = lazyWithRetry(() => import('./pages/commissions/calculation-details/ApprovalDetail'))
const AuditLogsPage = lazyWithRetry(() => import('./pages/admin/AuditLogsPage'))
const BackupManagementPage = lazyWithRetry(() => import('./pages/admin-settings/BackupManagementPage').then(m => ({ default: m.BackupManagementPage })))
const BatchAllocation = lazyWithRetry(() => import('./pages/inventory/batch-tracking/BatchAllocation'))
const BatchDetail = lazyWithRetry(() => import('./pages/inventory/batch-tracking/BatchDetail'))
const BatchExpiry = lazyWithRetry(() => import('./pages/inventory/batch-tracking/BatchExpiry'))
const BatchMovementHistory = lazyWithRetry(() => import('./pages/inventory/batch-tracking/BatchMovementHistory'))
const BoardComplianceChecks = lazyWithRetry(() => import('./pages/field-operations/board-management/BoardComplianceChecks'))
const BoardLocationChanges = lazyWithRetry(() => import('./pages/field-operations/board-management/BoardLocationChanges'))
const BoardMaintenanceLog = lazyWithRetry(() => import('./pages/field-operations/board-management/BoardMaintenanceLog'))
const BoardManagementPage = lazyWithRetry(() => import('./pages/admin/BoardManagementPage'))
const BoardPhotoHistory = lazyWithRetry(() => import('./pages/field-operations/board-management/BoardPhotoHistory'))
const BoardPlacementCreate = lazyWithRetry(() => import('./pages/field-operations/board-placements/BoardPlacementCreate'))
const BoardPlacementDetail = lazyWithRetry(() => import('./pages/field-operations/board-placements/BoardPlacementDetail'))
const BoardPlacementFormPage = lazyWithRetry(() => import('./pages/field-operations/BoardPlacementFormPage'))
const BoardPlacementHistory = lazyWithRetry(() => import('./pages/field-operations/board-management/BoardPlacementHistory'))
const BoardPlacementsList = lazyWithRetry(() => import('./pages/field-operations/board-placements/BoardPlacementsList'))
const BrandActivationFormPage = lazyWithRetry(() => import('./pages/BrandActivationFormPage'))
const BrandActivations = lazyWithRetry(() => import('./pages/brands/BrandActivations'))
const BrandActivationsPage = lazyWithRetry(() => import('./pages/brand-activations/BrandActivationsPage'))
const BrandBoards = lazyWithRetry(() => import('./pages/brands/BrandBoards'))
const BrandCreate = lazyWithRetry(() => import('./pages/brands/BrandCreate'))
const BrandDetail = lazyWithRetry(() => import('./pages/brands/BrandDetail'))
const BrandEdit = lazyWithRetry(() => import('./pages/brands/BrandEdit'))
const BrandInsightsPage = lazyWithRetry(() => import('./pages/field-operations/BrandInsightsPage'))
const BrandManagementPage = lazyWithRetry(() => import('./pages/admin/BrandManagementPage'))
const BrandOwnerDashboard = lazyWithRetry(() => import('./pages/brand-owner/BrandOwnerDashboard'))
const BrandOwnerReports = lazyWithRetry(() => import('./pages/brand-owner/BrandOwnerReports'))
const BrandProducts = lazyWithRetry(() => import('./pages/brands/BrandProducts'))
const BrandSurveys = lazyWithRetry(() => import('./pages/brands/BrandSurveys'))
const BrandsList = lazyWithRetry(() => import('./pages/brands/BrandsList'))
const CalculationDetail = lazyWithRetry(() => import('./pages/commissions/calculation-details/CalculationDetail'))
const CalculationLog = lazyWithRetry(() => import('./pages/commissions/calculation-details/CalculationLog'))
const CampaignCreate = lazyWithRetry(() => import('./pages/marketing/campaigns/CampaignCreate'))
const CampaignDetail = lazyWithRetry(() => import('./pages/marketing/campaigns/CampaignDetail'))
const CampaignEdit = lazyWithRetry(() => import('./pages/marketing/campaigns/CampaignEdit'))
const CampaignManagementPage = lazyWithRetry(() => import('./pages/trade-marketing/CampaignManagementPage'))
const CampaignsList = lazyWithRetry(() => import('./pages/marketing/campaigns/CampaignsList'))
const CampaignsPage = lazyWithRetry(() => import('./pages/campaigns/CampaignsPage'))
const CashReconciliationCreate = lazyWithRetry(() => import('./pages/finance/cash-reconciliation/CashReconciliationCreate'))
const CashReconciliationDetail = lazyWithRetry(() => import('./pages/finance/cash-reconciliation/CashReconciliationDetail'))
const CashReconciliationList = lazyWithRetry(() => import('./pages/finance/cash-reconciliation/CashReconciliationList'))
const CashVariance = lazyWithRetry(() => import('./pages/van-sales/cash-session-lines/CashVariance'))
const CollectionDetail = lazyWithRetry(() => import('./pages/van-sales/cash-session-lines/CollectionDetail'))
const CommissionApprovalPage = lazyWithRetry(() => import('./pages/commissions/CommissionApprovalPage').then(m => ({ default: m.CommissionApprovalPage })))
const CommissionCalculationPage = lazyWithRetry(() => import('./pages/commissions/CommissionCalculationPage').then(m => ({ default: m.CommissionCalculationPage })))
const CommissionCreate = lazyWithRetry(() => import('./pages/commissions/CommissionCreate'))
const CommissionDashboardPage = lazyWithRetry(() => import('./pages/commissions/CommissionDashboardPage').then(m => ({ default: m.CommissionDashboardPage })))
const CommissionDetail = lazyWithRetry(() => import('./pages/commissions/CommissionDetail'))
const CommissionEdit = lazyWithRetry(() => import('./pages/commissions/CommissionEdit'))
const CommissionInsights = lazyWithRetry(() => import('./pages/insights/CommissionInsights'))
const CommissionLedgerDetail = lazyWithRetry(() => import('./pages/field-operations/commission-ledger/CommissionLedgerDetail'))
const CommissionLedgerList = lazyWithRetry(() => import('./pages/field-operations/commission-ledger/CommissionLedgerList'))
const CommissionPaymentPage = lazyWithRetry(() => import('./pages/commissions/CommissionPaymentPage').then(m => ({ default: m.CommissionPaymentPage })))
const CommissionPayoutDetail = lazyWithRetry(() => import('./pages/finance/commission-payouts/CommissionPayoutDetail'))
const CommissionPayoutsList = lazyWithRetry(() => import('./pages/finance/commission-payouts/CommissionPayoutsList'))
const CommissionReportsPage = lazyWithRetry(() => import('./pages/commissions/CommissionReportsPage').then(m => ({ default: m.CommissionReportsPage })))
const CommissionRuleBuilderPage = lazyWithRetry(() => import('./pages/admin/CommissionRuleBuilderPage'))
const CommissionSettingsPage = lazyWithRetry(() => import('./pages/commissions/CommissionSettingsPage').then(m => ({ default: m.CommissionSettingsPage })))
const CommissionSummaryReport = lazyWithRetry(() => import('./pages/reports/finance/CommissionSummaryReport'))
const CompanyDashboardPage = lazyWithRetry(() => import('./pages/field-operations/CompanyDashboardPage'))
const CompanyLoginPage = lazyWithRetry(() => import('./pages/field-operations/CompanyLoginPage'))
const CompanyLoginsPage = lazyWithRetry(() => import('./pages/field-operations/CompanyLoginsPage'))
const CompanyManagementPage = lazyWithRetry(() => import('./pages/field-operations/CompanyManagementPage'))
const CompetitorInsights = lazyWithRetry(() => import('./pages/insights/CompetitorInsights'))
const CountLineApproval = lazyWithRetry(() => import('./pages/inventory/stock-count-lines/CountLineApproval'))
const CountLineDetail = lazyWithRetry(() => import('./pages/inventory/stock-count-lines/CountLineDetail'))
const CountLineEdit = lazyWithRetry(() => import('./pages/inventory/stock-count-lines/CountLineEdit'))
const CountLineList = lazyWithRetry(() => import('./pages/inventory/stock-count-lines/CountLineList'))
const CreditNoteCreate = lazyWithRetry(() => import('./pages/sales/credit-notes/CreditNoteCreate'))
const CreditNoteDetail = lazyWithRetry(() => import('./pages/sales/credit-notes/CreditNoteDetail'))
const CreditNotesList = lazyWithRetry(() => import('./pages/sales/credit-notes/CreditNotesList'))
const CustomerCreatePage = lazyWithRetry(() => import('./pages/customers/CustomerCreatePage'))
const CreditManagementPage = lazyWithRetry(() => import('./pages/customers/CreditManagementPage'))
const CustomerDashboard = lazyWithRetry(() => import('./pages/customers/CustomerDashboard'))
const CustomerDetailsPage = lazyWithRetry(() => import('./pages/customers/CustomerDetailsPage'))
const CustomerEditPage = lazyWithRetry(() => import('./pages/customers/CustomerEditPage'))
const CustomerKYC = lazyWithRetry(() => import('./pages/customers/tabs/CustomerKYC'))
const CustomerOrders = lazyWithRetry(() => import('./pages/customers/tabs/CustomerOrders'))
const CustomerPayments = lazyWithRetry(() => import('./pages/customers/tabs/CustomerPayments'))
const CustomerSelectionPage = lazyWithRetry(() => import('./pages/CustomerSelectionPage'))
const CustomerSurveys = lazyWithRetry(() => import('./pages/customers/tabs/CustomerSurveys'))
const CustomerVisits = lazyWithRetry(() => import('./pages/customers/tabs/CustomerVisits'))
const CustomersAdvanced = lazyWithRetry(() => import('./pages/CustomersAdvanced'))
const CustomersPage = lazyWithRetry(() => import('./pages/customers/CustomersPage'))
const DailyTargetsPage = lazyWithRetry(() => import('./pages/field-operations/DailyTargetsPage'))
const DashboardPage = lazyWithRetry(() => import('./pages/dashboard/DashboardPage'))
const DataImportExportPage = lazyWithRetry(() => import('./pages/admin/DataImportExportPage'))
const DeliveryDetail = lazyWithRetry(() => import('./pages/orders/deliveries/DeliveryDetail'))
const DeliveryEdit = lazyWithRetry(() => import('./pages/orders/deliveries/DeliveryEdit'))
const DeliveryList = lazyWithRetry(() => import('./pages/orders/deliveries/DeliveryList'))
const DeliveryPOD = lazyWithRetry(() => import('./pages/orders/deliveries/DeliveryPOD'))
const DeliveryStopDetail = lazyWithRetry(() => import('./pages/orders/deliveries/DeliveryStopDetail'))
const DeliveryStops = lazyWithRetry(() => import('./pages/orders/deliveries/DeliveryStops'))
const DepositDetail = lazyWithRetry(() => import('./pages/van-sales/cash-session-lines/DepositDetail'))
const EventCreate = lazyWithRetry(() => import('./pages/marketing/events/EventCreate'))
const EventDetail = lazyWithRetry(() => import('./pages/marketing/events/EventDetail'))
const EventEdit = lazyWithRetry(() => import('./pages/marketing/events/EventEdit'))
const EventsList = lazyWithRetry(() => import('./pages/marketing/events/EventsList'))
const EventsPage = lazyWithRetry(() => import('./pages/events/EventsPage'))
const ExceptionDetail = lazyWithRetry(() => import('./pages/commissions/calculation-details/ExceptionDetail'))
const ExecutiveInsightsDashboard = lazyWithRetry(() => import('./pages/insights/ExecutiveDashboard'))
const FOBoardPlacementDetail = lazyWithRetry(() => import('./pages/field-operations/visit-tasks/BoardPlacementDetail'))
const FOProductDistributionDetail = lazyWithRetry(() => import('./pages/field-operations/visit-tasks/ProductDistributionDetail'))
const FOSurveyDetail = lazyWithRetry(() => import('./pages/field-operations/visit-tasks/SurveyDetail'))
const FOVisitTaskDetail = lazyWithRetry(() => import('./pages/field-operations/visit-tasks/VisitTaskDetail'))
const FOVisitTaskEdit = lazyWithRetry(() => import('./pages/field-operations/visit-tasks/VisitTaskEdit'))
const FOVisitTaskList = lazyWithRetry(() => import('./pages/field-operations/visit-tasks/VisitTaskList'))
const FieldAgentDashboardPage = lazyWithRetry(() => import('./pages/field-operations/FieldAgentDashboardPage'))
const FieldMarketingAgentPage = lazyWithRetry(() => import('./pages/FieldMarketingAgentPage'))
const FieldOperationsDashboard = lazyWithRetry(() => import('./pages/field-operations/FieldOperationsDashboard'))
const FieldOperationsProductivityReport = lazyWithRetry(() => import('./pages/reports/operations/FieldOperationsProductivityReport'))
const FieldOpsInsights = lazyWithRetry(() => import('./pages/insights/FieldOpsInsights'))
const FieldOpsPerformancePage = lazyWithRetry(() => import('./pages/field-operations/FieldOpsPerformancePage'))
const FieldOpsSettingsPage = lazyWithRetry(() => import('./pages/field-operations/FieldOpsSettingsPage'))
const MonthlyTargetsPage = lazyWithRetry(() => import('./pages/field-operations/MonthlyTargetsPage'))
const TargetCommissionsPage = lazyWithRetry(() => import('./pages/field-operations/TargetCommissionsPage'))
const WorkingDaysConfigPage = lazyWithRetry(() => import('./pages/field-operations/WorkingDaysConfigPage'))
const FinanceDashboard = lazyWithRetry(() => import('./pages/finance/FinanceDashboard'))
const FinanceInvoiceCreate = lazyWithRetry(() => import('./pages/finance/InvoiceCreate'))
const FinanceInvoiceDetail = lazyWithRetry(() => import('./pages/finance/InvoiceDetail'))
const FinanceInvoiceEdit = lazyWithRetry(() => import('./pages/finance/InvoiceEdit'))
const FinancePaymentCreate = lazyWithRetry(() => import('./pages/finance/PaymentCreate'))
const FinancePaymentDetail = lazyWithRetry(() => import('./pages/finance/PaymentDetail'))
const FinancePaymentEdit = lazyWithRetry(() => import('./pages/finance/PaymentEdit'))
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/auth/ForgotPasswordPage'))
const GoalsInsights = lazyWithRetry(() => import('./pages/insights/GoalsInsights'))
const IndividualRegistrationPage = lazyWithRetry(() => import('./pages/field-operations/IndividualRegistrationPage'))
const IntegrationsPage = lazyWithRetry(() => import('./pages/admin-settings/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })))
const InventoryDashboard = lazyWithRetry(() => import('./pages/inventory/InventoryDashboard'))
const InventoryManagement = lazyWithRetry(() => import('./pages/inventory/InventoryManagement'))
const InventoryReports = lazyWithRetry(() => import('./pages/inventory/InventoryReports'))
const InventorySnapshotReport = lazyWithRetry(() => import('./pages/reports/inventory/InventorySnapshotReport'))
const InventoryTrackingPage = lazyWithRetry(() => import('./pages/van-sales/InventoryTrackingPage'))
const InvoiceCreate = lazyWithRetry(() => import('./pages/sales/invoices/InvoiceCreate'))
const InvoiceDetail = lazyWithRetry(() => import('./pages/sales/invoices/InvoiceDetail'))
const InvoiceItemDetail = lazyWithRetry(() => import('./pages/finance/invoice-items/InvoiceItemDetail'))
const InvoiceItemEdit = lazyWithRetry(() => import('./pages/finance/invoice-items/InvoiceItemEdit'))
const InvoiceItemHistory = lazyWithRetry(() => import('./pages/finance/invoice-items/InvoiceItemHistory'))
const InvoiceItemList = lazyWithRetry(() => import('./pages/finance/invoice-items/InvoiceItemList'))
const InvoiceItems = lazyWithRetry(() => import('./pages/finance/InvoiceItems'))
const InvoiceManagementPage = lazyWithRetry(() => import('./pages/finance/InvoiceManagementPage'))
const InvoicePayments = lazyWithRetry(() => import('./pages/finance/InvoicePayments'))
const InvoiceStatusHistory = lazyWithRetry(() => import('./pages/finance/invoice-status-history/InvoiceStatusHistory'))
const InvoicesList = lazyWithRetry(() => import('./pages/sales/invoices/InvoicesList'))
const IssueCreate = lazyWithRetry(() => import('./pages/inventory/issues/IssueCreate'))
const IssueDetail = lazyWithRetry(() => import('./pages/inventory/issues/IssueDetail'))
const IssuesList = lazyWithRetry(() => import('./pages/inventory/issues/IssuesList'))
const KYCCreate = lazyWithRetry(() => import('./pages/kyc/KYCCreate'))
const KYCDashboard = lazyWithRetry(() => import('./pages/kyc/KYCDashboard'))
const KYCDetail = lazyWithRetry(() => import('./pages/kyc/KYCDetail'))
const KYCEdit = lazyWithRetry(() => import('./pages/kyc/KYCEdit'))
const KYCManagement = lazyWithRetry(() => import('./pages/kyc/KYCManagement'))
const KYCReports = lazyWithRetry(() => import('./pages/kyc/KYCReports'))
const LandingPage = lazyWithRetry(() => import('./pages/marketing/LandingPage'))
const LiveGPSTrackingPage = lazyWithRetry(() => import('./pages/field-operations/LiveGPSTrackingPage'))
const LoginPage = lazyWithRetry(() => import('./pages/auth/LoginPage'))
const LotDetail = lazyWithRetry(() => import('./pages/inventory/batch-tracking/LotDetail'))
const LotTracking = lazyWithRetry(() => import('./pages/inventory/batch-tracking/LotTracking'))
const MerchandisingCompliancePage = lazyWithRetry(() => import('./pages/trade-marketing/MerchandisingCompliancePage'))
const MobileLoginPage = lazyWithRetry(() => import('./pages/auth/MobileLoginPage'))
const MobileDashboard = lazyWithRetry(() => import('./pages/mobile/MobileDashboard'))
const MoreMenuPage = lazyWithRetry(() => import('./pages/mobile/MoreMenuPage'))
const MovementDetail = lazyWithRetry(() => import('./pages/inventory/stock-ledger/MovementDetail'))
const OrderCreatePage = lazyWithRetry(() => import('./pages/orders/OrderCreatePage'))
const OrderDashboard = lazyWithRetry(() => import('./pages/orders/OrderDashboard'))
const OrderDelivery = lazyWithRetry(() => import('./pages/orders/tabs/OrderDelivery'))
const OrderDetailsPage = lazyWithRetry(() => import('./pages/orders/OrderDetailsPage'))
const OrderEditPage = lazyWithRetry(() => import('./pages/orders/OrderEditPage'))
const OrderItemDetail = lazyWithRetry(() => import('./pages/orders/items/OrderItemDetail'))
const OrderItemEdit = lazyWithRetry(() => import('./pages/orders/items/OrderItemEdit'))
const OrderItemHistory = lazyWithRetry(() => import('./pages/orders/items/OrderItemHistory'))
const OrderItemList = lazyWithRetry(() => import('./pages/orders/items/OrderItemList'))
const OrderItems = lazyWithRetry(() => import('./pages/orders/tabs/OrderItems'))
const OrderPayments = lazyWithRetry(() => import('./pages/orders/tabs/OrderPayments'))
const OrderReturns = lazyWithRetry(() => import('./pages/orders/tabs/OrderReturns'))
const OrderStatusHistory = lazyWithRetry(() => import('./pages/orders/status-history/OrderStatusHistory'))
const OrdersKanban = lazyWithRetry(() => import('./pages/OrdersKanban'))
const OrdersPage = lazyWithRetry(() => import('./pages/orders/OrdersPage'))
const POSLibraryPage = lazyWithRetry(() => import('./pages/admin/POSLibraryPage'))
const POSMaterialTrackerPage = lazyWithRetry(() => import('./pages/POSMaterialTrackerPage'))
const PaymentAllocationCreate = lazyWithRetry(() => import('./pages/finance/payment-allocations/PaymentAllocationCreate'))
const PaymentAllocationDetail = lazyWithRetry(() => import('./pages/finance/payment-allocations/PaymentAllocationDetail'))
const PaymentAllocationEdit = lazyWithRetry(() => import('./pages/finance/payment-allocations/PaymentAllocationEdit'))
const PaymentAllocationList = lazyWithRetry(() => import('./pages/finance/payment-allocations/PaymentAllocationList'))
const PaymentCollectionPage = lazyWithRetry(() => import('./pages/finance/PaymentCollectionPage'))
const PaymentCreate = lazyWithRetry(() => import('./pages/sales/payments/PaymentCreate'))
const PaymentDetail = lazyWithRetry(() => import('./pages/sales/payments/PaymentDetail'))
const PaymentStatusHistory = lazyWithRetry(() => import('./pages/finance/payment-status-history/PaymentStatusHistory'))
const PaymentsList = lazyWithRetry(() => import('./pages/sales/payments/PaymentsList'))
const PayoutAuditTrail = lazyWithRetry(() => import('./pages/commissions/payout-lines/PayoutAuditTrail'))
const PayoutLineDetail = lazyWithRetry(() => import('./pages/commissions/payout-lines/PayoutLineDetail'))
const PayoutLineEdit = lazyWithRetry(() => import('./pages/commissions/payout-lines/PayoutLineEdit'))
const PayoutLineList = lazyWithRetry(() => import('./pages/commissions/payout-lines/PayoutLineList'))
const PerformanceDrillDownPage = lazyWithRetry(() => import('./pages/field-operations/PerformanceDrillDownPage'))
const PhotoDetail = lazyWithRetry(() => import('./pages/field-operations/photos/PhotoDetail'))
const PhotoEvidence = lazyWithRetry(() => import('./pages/field-operations/photos/PhotoEvidence'))
const PhotoGallery = lazyWithRetry(() => import('./pages/field-operations/photos/PhotoGallery'))
const PhotoTimeline = lazyWithRetry(() => import('./pages/field-operations/photos/PhotoTimeline'))
const PriceListEditPage = lazyWithRetry(() => import('./pages/admin/PriceListEditPage'))
const PriceListManagementPage = lazyWithRetry(() => import('./pages/admin/PriceListManagementPage'))
const ProductAnalyticsPage = lazyWithRetry(() => import('./pages/product-management/ProductAnalyticsPage').then(m => ({ default: m.ProductAnalyticsPage })))
const ProductCreatePage = lazyWithRetry(() => import('./pages/products/ProductCreatePage'))
const ProductDetailsPage = lazyWithRetry(() => import('./pages/products/ProductDetailsPage'))
const ProductDistributionCreate = lazyWithRetry(() => import('./pages/field-operations/product-distributions/ProductDistributionCreate'))
const ProductDistributionDetail = lazyWithRetry(() => import('./pages/field-operations/product-distributions/ProductDistributionDetail'))
const ProductDistributionFormPage = lazyWithRetry(() => import('./pages/field-operations/ProductDistributionFormPage'))
const ProductDistributionsList = lazyWithRetry(() => import('./pages/field-operations/product-distributions/ProductDistributionsList'))
const ProductEditPage = lazyWithRetry(() => import('./pages/products/ProductEditPage'))
const ProductHierarchyPage = lazyWithRetry(() => import('./pages/product-management/ProductHierarchyPage').then(m => ({ default: m.ProductHierarchyPage })))
const ProductImportExportPage = lazyWithRetry(() => import('./pages/product-management/ProductImportExportPage').then(m => ({ default: m.ProductImportExportPage })))
const ProductInventory = lazyWithRetry(() => import('./pages/products/tabs/ProductInventory'))
const ProductInventoryPage = lazyWithRetry(() => import('./pages/product-management/ProductInventoryPage').then(m => ({ default: m.ProductInventoryPage })))
const ProductListPage = lazyWithRetry(() => import('./pages/product-management/ProductListPage').then(m => ({ default: m.ProductListPage })))
const ProductPricing = lazyWithRetry(() => import('./pages/products/tabs/ProductPricing'))
const ProductPricingPage = lazyWithRetry(() => import('./pages/product-management/ProductPricingPage').then(m => ({ default: m.ProductPricingPage })))
const ProductPromotions = lazyWithRetry(() => import('./pages/products/tabs/ProductPromotions'))
const ProductSales = lazyWithRetry(() => import('./pages/products/tabs/ProductSales'))
const ProductTypeBuilderPage = lazyWithRetry(() => import('./pages/admin/ProductTypeBuilderPage'))
const ProductsPage = lazyWithRetry(() => import('./pages/products/ProductsPage'))
const PromoterCreate = lazyWithRetry(() => import('./pages/trade-marketing/promoters/PromoterCreate'))
const PromoterDetail = lazyWithRetry(() => import('./pages/trade-marketing/promoters/PromoterDetail'))
const PromoterEdit = lazyWithRetry(() => import('./pages/trade-marketing/promoters/PromoterEdit'))
const PromoterManagementPage = lazyWithRetry(() => import('./pages/trade-marketing/PromoterManagementPage'))
const PromotionCreate = lazyWithRetry(() => import('./pages/marketing/promotions/PromotionCreate'))
const PromotionDetail = lazyWithRetry(() => import('./pages/marketing/promotions/PromotionDetail'))
const PromotionsDashboard = lazyWithRetry(() => import('./pages/promotions/PromotionsDashboard'))
const PromotionsList = lazyWithRetry(() => import('./pages/marketing/promotions/PromotionsList'))
const PromotionsManagement = lazyWithRetry(() => import('./pages/promotions/PromotionsManagement'))
const ReceiptCreate = lazyWithRetry(() => import('./pages/inventory/receipts/ReceiptCreate'))
const ReceiptDetail = lazyWithRetry(() => import('./pages/inventory/receipts/ReceiptDetail'))
const ReceiptsList = lazyWithRetry(() => import('./pages/inventory/receipts/ReceiptsList'))
const ReportBuilderPage = lazyWithRetry(() => import('./pages/reports/ReportBuilderPage'))
const ReportCreate = lazyWithRetry(() => import('./pages/reports/ReportCreate'))
const ReportDetail = lazyWithRetry(() => import('./pages/reports/ReportDetail'))
const ReportEdit = lazyWithRetry(() => import('./pages/reports/ReportEdit'))
const ReportTemplatesPage = lazyWithRetry(() => import('./pages/reports/ReportTemplatesPage'))
const ReportsHub = lazyWithRetry(() => import('./pages/reports/ReportsHub'))
const ResetPasswordPage = lazyWithRetry(() => import('./pages/auth/ResetPasswordPage'))
const ReturnItemApproval = lazyWithRetry(() => import('./pages/orders/returns-items/ReturnItemApproval'))
const ReturnItemDetail = lazyWithRetry(() => import('./pages/orders/returns-items/ReturnItemDetail'))
const ReturnItemEdit = lazyWithRetry(() => import('./pages/orders/returns-items/ReturnItemEdit'))
const ReturnItemList = lazyWithRetry(() => import('./pages/orders/returns-items/ReturnItemList'))
const RoleManagementPage = lazyWithRetry(() => import('./pages/admin-settings/RoleManagementPage').then(m => ({ default: m.RoleManagementPage })))
const RolePermissionsPage = lazyWithRetry(() => import('./pages/admin/RolePermissionsPage'))
const RouteAuditPage = lazyWithRetry(() => import('./pages/admin/RouteAuditPage'))
const RouteCreate = lazyWithRetry(() => import('./pages/van-sales-depth/RouteCreate'))
const RouteCustomers = lazyWithRetry(() => import('./pages/van-sales-depth/RouteCustomers'))
const RouteDetail = lazyWithRetry(() => import('./pages/van-sales-depth/RouteDetail'))
const RouteEdit = lazyWithRetry(() => import('./pages/van-sales-depth/RouteEdit'))
const RouteManagementPage = lazyWithRetry(() => import('./pages/van-sales/RouteManagementPage'))
const RouteOrders = lazyWithRetry(() => import('./pages/van-sales-depth/RouteOrders'))
const RoutePerformance = lazyWithRetry(() => import('./pages/van-sales-depth/RoutePerformance'))
const RouteStopDetail = lazyWithRetry(() => import('./pages/van-sales/route-stops/RouteStopDetail'))
const RouteStopEdit = lazyWithRetry(() => import('./pages/van-sales/route-stops/RouteStopEdit'))
const RouteStopExceptions = lazyWithRetry(() => import('./pages/van-sales/route-stops/RouteStopExceptions'))
const RouteStopList = lazyWithRetry(() => import('./pages/van-sales/route-stops/RouteStopList'))
const RouteStopPerformance = lazyWithRetry(() => import('./pages/van-sales/route-stops/RouteStopPerformance'))
const RuleConditionDetail = lazyWithRetry(() => import('./pages/commissions/calculation-details/RuleConditionDetail'))
const RuleCreate = lazyWithRetry(() => import('./pages/commissions/RuleCreate'))
const RuleDetail = lazyWithRetry(() => import('./pages/commissions/RuleDetail'))
const RuleEdit = lazyWithRetry(() => import('./pages/commissions/RuleEdit'))
const SKUAvailabilityCheckerPage = lazyWithRetry(() => import('./pages/SKUAvailabilityCheckerPage'))
const SalesDashboard = lazyWithRetry(() => import('./pages/sales/SalesDashboard'))
const SalesExceptionsReport = lazyWithRetry(() => import('./pages/reports/sales/SalesExceptionsReport'))
const SalesInsights = lazyWithRetry(() => import('./pages/insights/SalesInsights'))
const SalesOrderCreate = lazyWithRetry(() => import('./pages/sales/orders/SalesOrderCreate'))
const SalesOrderDetail = lazyWithRetry(() => import('./pages/sales/orders/SalesOrderDetail'))
const SalesOrderEdit = lazyWithRetry(() => import('./pages/sales/orders/SalesOrderEdit'))
const SalesOrdersList = lazyWithRetry(() => import('./pages/sales/orders/SalesOrdersList'))
const SalesReturnCreate = lazyWithRetry(() => import('./pages/sales/returns/SalesReturnCreate'))
const SalesReturnDetail = lazyWithRetry(() => import('./pages/sales/returns/SalesReturnDetail'))
const SalesReturnsList = lazyWithRetry(() => import('./pages/sales/returns/SalesReturnsList'))
const SalesSummaryReport = lazyWithRetry(() => import('./pages/reports/sales/SalesSummaryReport'))
const SerialDetail = lazyWithRetry(() => import('./pages/inventory/batch-tracking/SerialDetail'))
const SerialTracking = lazyWithRetry(() => import('./pages/inventory/batch-tracking/SerialTracking'))
const ShareOfVoiceInsights = lazyWithRetry(() => import('./pages/insights/ShareOfVoiceInsights'))
const ShelfAnalyticsFormPage = lazyWithRetry(() => import('./pages/ShelfAnalyticsFormPage'))
const SmokeTestPage = lazyWithRetry(() => import('./pages/admin/SmokeTestPage'))
const SourceTransactions = lazyWithRetry(() => import('./pages/commissions/payout-lines/SourceTransactions'))
const StatusTransitionDetail = lazyWithRetry(() => import('./pages/orders/status-history/StatusTransitionDetail'))
const StockCountCreate = lazyWithRetry(() => import('./pages/inventory/stock-counts/StockCountCreate'))
const StockCountDetail = lazyWithRetry(() => import('./pages/inventory/stock-counts/StockCountDetail'))
const StockCountWorkflowPage = lazyWithRetry(() => import('./pages/inventory/StockCountWorkflowPage'))
const StockCountsList = lazyWithRetry(() => import('./pages/inventory/stock-counts/StockCountsList'))
const StockInsights = lazyWithRetry(() => import('./pages/insights/StockInsights'))
const StockLedgerByProduct = lazyWithRetry(() => import('./pages/inventory/stock-ledger/StockLedgerByProduct'))
const StockLedgerByWarehouse = lazyWithRetry(() => import('./pages/inventory/stock-ledger/StockLedgerByWarehouse'))
const StockLedgerDetail = lazyWithRetry(() => import('./pages/inventory/stock-ledger/StockLedgerDetail'))
const SurveyAnalysis = lazyWithRetry(() => import('./pages/field-operations/survey-responses/SurveyAnalysis'))
const SurveyAnalytics = lazyWithRetry(() => import('./pages/surveys/SurveyAnalytics'))
const SurveyAnswerDetail = lazyWithRetry(() => import('./pages/field-operations/survey-responses/SurveyAnswerDetail'))
const SurveyBuilderPage = lazyWithRetry(() => import('./pages/admin/SurveyBuilderPage'))
const SurveyComparison = lazyWithRetry(() => import('./pages/field-operations/survey-responses/SurveyComparison'))
const SurveyCreate = lazyWithRetry(() => import('./pages/surveys/SurveyCreate'))
const SurveyEdit = lazyWithRetry(() => import('./pages/surveys/SurveyEdit'))
const SurveyResponseDetail = lazyWithRetry(() => import('./pages/field-operations/survey-responses/SurveyResponseDetail'))
const SurveyResponseEdit = lazyWithRetry(() => import('./pages/field-operations/survey-responses/SurveyResponseEdit'))
const SurveyResponses = lazyWithRetry(() => import('./pages/surveys/SurveyResponses'))
const SurveysDashboard = lazyWithRetry(() => import('./pages/surveys/SurveysDashboard'))
const SurveysManagement = lazyWithRetry(() => import('./pages/surveys/SurveysManagement'))
const SystemHealthPage = lazyWithRetry(() => import('./pages/admin-settings/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })))
const SystemSettingsPage = lazyWithRetry(() => import('./pages/admin/SystemSettingsPage'))
const TenantManagement = lazyWithRetry(() => import('./pages/superadmin/TenantManagement'))
const TenantModules = lazyWithRetry(() => import('./pages/superadmin/TenantModules'))
const CompanySetupPage = lazyWithRetry(() => import('./pages/admin/CompanySetupPage'))
const TerritoryManagementPage = lazyWithRetry(() => import('./pages/admin/TerritoryManagementPage'))
const TMCampaignCreate = lazyWithRetry(() => import('./pages/trade-marketing/campaigns/TMCampaignCreate'))
const TMCampaignDetail = lazyWithRetry(() => import('./pages/trade-marketing/campaigns/TMCampaignDetail'))
const TMCampaignEdit = lazyWithRetry(() => import('./pages/trade-marketing/campaigns/TMCampaignEdit'))
const TradeMarketingAgentPage = lazyWithRetry(() => import('./pages/TradeMarketingAgentPage'))
const TradeMarketingAnalyticsPage = lazyWithRetry(() => import('./pages/trade-marketing/TradeMarketingAnalyticsPage'))
const TradeMarketingPage = lazyWithRetry(() => import('./pages/trade-marketing/TradeMarketingPage'))
const TradePromoInsights = lazyWithRetry(() => import('./pages/insights/TradePromoInsights'))
const TransferCreate = lazyWithRetry(() => import('./pages/inventory/transfers/TransferCreate'))
const TransferDetail = lazyWithRetry(() => import('./pages/inventory/transfers/TransferDetail'))
const TransferItemDetail = lazyWithRetry(() => import('./pages/inventory/transfer-items/TransferItemDetail'))
const TransferItemEdit = lazyWithRetry(() => import('./pages/inventory/transfer-items/TransferItemEdit'))
const TransferItemList = lazyWithRetry(() => import('./pages/inventory/transfer-items/TransferItemList'))
const TransferItemTracking = lazyWithRetry(() => import('./pages/inventory/transfer-items/TransferItemTracking'))
const TransfersList = lazyWithRetry(() => import('./pages/inventory/transfers/TransfersList'))
const UserManagementPage = lazyWithRetry(() => import('./pages/admin/UserManagementPage'))
const VanCashCollectionPage = lazyWithRetry(() => import('./pages/van-sales/VanCashCollectionPage'))
const VanCashReconciliationCreate = lazyWithRetry(() => import('./pages/van-sales/cash-reconciliation/CashReconciliationCreate'))
const VanCashReconciliationDetail = lazyWithRetry(() => import('./pages/van-sales/cash-reconciliation/CashReconciliationDetail'))
const VanCashReconciliationList = lazyWithRetry(() => import('./pages/van-sales/cash-reconciliation/CashReconciliationList'))
const VanInventoryPage = lazyWithRetry(() => import('./pages/van-sales/VanInventoryPage'))
const VanLoadCreate = lazyWithRetry(() => import('./pages/van-sales/van-loads/VanLoadCreate'))
const VanLoadDetail = lazyWithRetry(() => import('./pages/van-sales/van-loads/VanLoadDetail'))
const VanLoadItemDetail = lazyWithRetry(() => import('./pages/van-sales/van-load-items/VanLoadItemDetail'))
const VanLoadItemEdit = lazyWithRetry(() => import('./pages/van-sales/van-load-items/VanLoadItemEdit'))
const VanLoadItemList = lazyWithRetry(() => import('./pages/van-sales/van-load-items/VanLoadItemList'))
const VanLoadReconciliation = lazyWithRetry(() => import('./pages/van-sales/van-load-items/VanLoadReconciliation'))
const VanLoadVariance = lazyWithRetry(() => import('./pages/van-sales/van-load-items/VanLoadVariance'))
const VanLoadsList = lazyWithRetry(() => import('./pages/van-sales/van-loads/VanLoadsList'))
const VanOrderCreatePage = lazyWithRetry(() => import('./pages/van-sales/VanOrderCreatePage'))
const VanOrdersListPage = lazyWithRetry(() => import('./pages/van-sales/VanOrdersListPage'))
const VanPerformancePage = lazyWithRetry(() => import('./pages/van-sales/VanPerformancePage'))
const VanRouteDetailsPage = lazyWithRetry(() => import('./pages/van-sales/VanRouteDetailsPage'))
const VanRoutesListPage = lazyWithRetry(() => import('./pages/van-sales/VanRoutesListPage'))
const VanSalesDashboard = lazyWithRetry(() => import('./pages/van-sales/VanSalesDashboard'))
const VanSalesInsights = lazyWithRetry(() => import('./pages/insights/VanSalesInsights'))
const VanSalesOrderCreate = lazyWithRetry(() => import('./pages/van-sales/orders/VanSalesOrderCreate'))
const VanSalesOrderDetail = lazyWithRetry(() => import('./pages/van-sales/orders/VanSalesOrderDetail'))
const VanSalesOrderEdit = lazyWithRetry(() => import('./pages/van-sales/orders/VanSalesOrderEdit'))
const VanSalesOrdersList = lazyWithRetry(() => import('./pages/van-sales/orders/VanSalesOrdersList'))
const VanSalesPage = lazyWithRetry(() => import('./pages/van-sales/VanSalesPage'))
const VanSalesReturnCreate = lazyWithRetry(() => import('./pages/van-sales/returns/VanSalesReturnCreate'))
const VanSalesReturnDetail = lazyWithRetry(() => import('./pages/van-sales/returns/VanSalesReturnDetail'))
const VanSalesReturnsList = lazyWithRetry(() => import('./pages/van-sales/returns/VanSalesReturnsList'))
const VanSalesWorkflowPage = lazyWithRetry(() => import('./pages/van-sales/VanSalesWorkflowPage'))
const VanSalesWorkflowPageMobile = lazyWithRetry(() => import('./pages/van-sales/VanSalesWorkflowPageMobile'))
const VarianceAnalysisReport = lazyWithRetry(() => import('./pages/reports/inventory/VarianceAnalysisReport'))
const VarianceResolution = lazyWithRetry(() => import('./pages/inventory/stock-count-lines/VarianceResolution'))
const VisitConfigurationPage = lazyWithRetry(() => import('./pages/field-operations/VisitConfigurationPage'))
const ProcessFlowManagementPage = lazyWithRetry(() => import('./pages/field-operations/ProcessFlowManagementPage'))
const VisitCreate = lazyWithRetry(() => import('./pages/field-operations/visits/VisitCreate'))
const VisitDetail = lazyWithRetry(() => import('./pages/field-operations/visits/VisitDetail'))
const VisitEdit = lazyWithRetry(() => import('./pages/field-operations/visits/VisitEdit'))
const VisitHistoryPage = lazyWithRetry(() => import('./pages/field-operations/VisitHistoryPage'))
const VisitManagementPage = lazyWithRetry(() => import('./pages/field-operations/VisitManagementPage'))
const VisitWorkflowPage = lazyWithRetry(() => import('./pages/VisitWorkflowPage'))
const VisitsList = lazyWithRetry(() => import('./pages/field-operations/visits/VisitsList'))

// Field Operations Reports (SSReports-style)
const ReportsDashboard = lazyWithRetry(() => import('./pages/field-operations/reports/ReportsDashboard'))
const ReportsInsights = lazyWithRetry(() => import('./pages/field-operations/reports/ReportsInsights'))
const ReportsShopsAnalytics = lazyWithRetry(() => import('./pages/field-operations/reports/ReportsShopsAnalytics'))
const ReportsCustomersAnalytics = lazyWithRetry(() => import('./pages/field-operations/reports/ReportsCustomersAnalytics'))
const ReportsCheckinsList = lazyWithRetry(() => import('./pages/field-operations/reports/ReportsCheckinsList'))
const ReportsExport = lazyWithRetry(() => import('./pages/field-operations/reports/ReportsExport'))

// T-21: Suspense fallback for lazy-loaded pages
function PageLoader({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-[400px] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    }>
      {children}
    </Suspense>
  )
}

const MOBILE_ROLES = ['agent', 'team_lead', 'field_agent', 'sales_rep', 'manager']

function App() {
  const { isAuthenticated, isLoading, initialize, hydrated, user } = useAuthStore()

  useEffect(() => {
    // Clear chunk reload flag on successful app load
    sessionStorage.removeItem('chunk_reload');
  }, [])

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
          <Route path="/" element={<PageLoader><LandingPage /></PageLoader>} />

          {/* Public Routes */}
          <Route path="/auth/*" element={
            isAuthenticated ? <Navigate to={user?.role && MOBILE_ROLES.includes(user.role) ? '/agent/dashboard' : '/dashboard'} replace /> : <AuthLayout />
          }>
            <Route path="login" element={<PageLoader><LoginPage /></PageLoader>} />
            <Route path="forgot-password" element={<PageLoader><ForgotPasswordPage /></PageLoader>} />
            <Route path="reset-password" element={<PageLoader><ResetPasswordPage /></PageLoader>} />
            <Route path="mobile-login" element={<PageLoader><MobileLoginPage /></PageLoader>} />
            <Route index element={<Navigate to="login" replace />} />
          </Route>

          {/* Legacy login redirect */}
          <Route path="/login" element={<Navigate to="/auth/login" replace />} />

          {/* Company Portal Login (public) */}
          <Route path="/company-login" element={<PageLoader><CompanyLoginPage /></PageLoader>} />
          {/* Company Portal Dashboard (uses company_token, not main auth) */}
          <Route path="/company-portal/:companyId" element={<PageLoader><CompanyDashboardPage /></PageLoader>} />

          {/* Protected Routes - using pathless parent to avoid catch-all matching "/" */}
          <Route element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            {/* Dashboard Routes */}
            <Route path="dashboard" element={<PageLoader><DashboardPage /></PageLoader>} />
            <Route path="analytics" element={<PageLoader><AnalyticsPage /></PageLoader>} />
            
            <Route path="analytics-dashboard/*" element={<Navigate to="/insights" replace />} />
            
                        {/* Reports Routes */}
                        <Route path="reports" element={<PageLoader><ReportsHub /></PageLoader>} />
                        <Route path="reports/hub" element={<PageLoader><ReportsHub /></PageLoader>} />
                        <Route path="reports/builder" element={<PageLoader><ReportBuilderPage /></PageLoader>} />
            <Route path="reports/templates" element={<PageLoader><ReportTemplatesPage /></PageLoader>} />
            <Route path="reports/create" element={<PageLoader><ReportCreate /></PageLoader>} />
            <Route path="reports/:id" element={<PageLoader><ReportDetail /></PageLoader>} />
            <Route path="reports/:id/edit" element={<PageLoader><ReportEdit /></PageLoader>} />
            <Route path="reports/sales/summary" element={<PageLoader><SalesSummaryReport /></PageLoader>} />
            <Route path="reports/sales/exceptions" element={<PageLoader><SalesExceptionsReport /></PageLoader>} />
            <Route path="reports/finance/commission-summary" element={<PageLoader><CommissionSummaryReport /></PageLoader>} />
            <Route path="reports/inventory/snapshot" element={<PageLoader><InventorySnapshotReport /></PageLoader>} />
            <Route path="reports/inventory/variance" element={<PageLoader><VarianceAnalysisReport /></PageLoader>} />
            <Route path="reports/operations/field-ops-productivity" element={<PageLoader><FieldOperationsProductivityReport /></PageLoader>} />
            
            <Route path="reports-analytics/*" element={<Navigate to="/reports" replace />} />

            {/* Van Sales Routes */}
            <Route path="van-sales" element={<PageLoader><VanSalesDashboard /></PageLoader>} />
            <Route path="van-sales/dashboard" element={<PageLoader><VanSalesDashboard /></PageLoader>} />
            <Route path="van-sales/workflow" element={<PageLoader><VanSalesWorkflowPageMobile /></PageLoader>} />
            <Route path="van-sales/management" element={<PageLoader><VanSalesPage /></PageLoader>} />
            <Route path="van-sales/performance" element={<PageLoader><VanPerformancePage /></PageLoader>} />
            <Route path="van-sales/cash-collection" element={<PageLoader><VanCashCollectionPage /></PageLoader>} />
            <Route path="van-sales/van-inventory" element={<PageLoader><VanInventoryPage /></PageLoader>} />
            <Route path="van-sales/routes" element={<PageLoader><VanRoutesListPage /></PageLoader>} />
            <Route path="van-sales/routes/create" element={<PageLoader><RouteCreate /></PageLoader>} />
            <Route path="van-sales/routes/:id" element={<PageLoader><RouteDetail /></PageLoader>} />
            <Route path="van-sales/routes/:id/edit" element={<PageLoader><RouteEdit /></PageLoader>} />
            <Route path="van-sales/routes/:id/customers" element={<PageLoader><RouteCustomers /></PageLoader>} />
            <Route path="van-sales/routes/:id/orders" element={<PageLoader><RouteOrders /></PageLoader>} />
            <Route path="van-sales/routes/:id/performance" element={<PageLoader><RoutePerformance /></PageLoader>} />
            <Route path="van-sales/inventory" element={<PageLoader><InventoryTrackingPage /></PageLoader>} />
            <Route path="van-sales/orders" element={<PageLoader><VanSalesOrdersList /></PageLoader>} />
            <Route path="van-sales/orders/create" element={<PageLoader><VanOrderCreatePage /></PageLoader>} />
            <Route path="van-sales/orders/new" element={<PageLoader><VanSalesOrderCreate /></PageLoader>} />
            <Route path="van-sales/orders/:id" element={<PageLoader><VanSalesOrderDetail /></PageLoader>} />
            <Route path="van-sales/orders/:id/edit" element={<PageLoader><VanSalesOrderEdit /></PageLoader>} />
            <Route path="van-sales/returns" element={<PageLoader><VanSalesReturnsList /></PageLoader>} />
            <Route path="van-sales/returns/create" element={<PageLoader><VanSalesReturnCreate /></PageLoader>} />
            <Route path="van-sales/returns/:id" element={<PageLoader><VanSalesReturnDetail /></PageLoader>} />
            <Route path="van-sales/van-loads" element={<PageLoader><VanLoadsList /></PageLoader>} />
            <Route path="van-sales/van-loads/create" element={<PageLoader><VanLoadCreate /></PageLoader>} />
            <Route path="van-sales/van-loads/:id" element={<PageLoader><VanLoadDetail /></PageLoader>} />
            <Route path="van-sales/cash-reconciliation" element={<PageLoader><VanCashReconciliationList /></PageLoader>} />
            <Route path="van-sales/cash-reconciliation/create" element={<PageLoader><VanCashReconciliationCreate /></PageLoader>} />
            <Route path="van-sales/cash-reconciliation/:id" element={<PageLoader><VanCashReconciliationDetail /></PageLoader>} />

            {/* Field Operations Routes */}
            <Route path="field-operations" element={<PageLoader><FieldOperationsDashboard /></PageLoader>} />
            <Route path="field-operations/dashboard" element={<PageLoader><FieldOperationsDashboard /></PageLoader>} />
            <Route path="field-operations/agent-dashboard" element={<PageLoader><FieldAgentDashboardPage /></PageLoader>} />
            <Route path="field-operations/agents" element={<Navigate to="/field-operations" replace />} />
            <Route path="field-operations/mapping" element={<Navigate to="/field-operations/gps-tracking" replace />} />
            <Route path="field-operations/live-map" element={<PageLoader><LiveGPSTrackingPage /></PageLoader>} />
            <Route path="field-operations/gps-tracking" element={<PageLoader><LiveGPSTrackingPage /></PageLoader>} />
            <Route path="field-operations/boards" element={<PageLoader><BoardPlacementsList /></PageLoader>} />
            <Route path="field-operations/boards/create" element={<PageLoader><BoardPlacementFormPage /></PageLoader>} />
            <Route path="field-operations/boards/:id" element={<PageLoader><BoardPlacementDetail /></PageLoader>} />
            <Route path="field-operations/products" element={<PageLoader><ProductDistributionsList /></PageLoader>} />
            <Route path="field-operations/products/create" element={<PageLoader><ProductDistributionFormPage /></PageLoader>} />
            <Route path="field-operations/products/:id" element={<PageLoader><ProductDistributionDetail /></PageLoader>} />
            <Route path="field-operations/commission" element={<PageLoader><CommissionLedgerList /></PageLoader>} />
            <Route path="field-operations/commission/:id" element={<PageLoader><CommissionLedgerDetail /></PageLoader>} />
            <Route path="field-operations/visits" element={<PageLoader><VisitManagementPage /></PageLoader>} />
            <Route path="field-operations/visits/stores" element={<PageLoader><VisitManagementPage visitType="store" /></PageLoader>} />
            <Route path="field-operations/visits/individuals" element={<PageLoader><VisitManagementPage visitType="individual" /></PageLoader>} />
            <Route path="field-operations/visits/create" element={<PageLoader><VisitCreate /></PageLoader>} />
            <Route path="field-operations/visits/:id" element={<PageLoader><VisitDetail /></PageLoader>} />
            <Route path="field-operations/visits/:id/edit" element={<PageLoader><VisitEdit /></PageLoader>} />
            <Route path="field-operations/visit-configurations" element={<PageLoader><VisitConfigurationPage /></PageLoader>} />
            <Route path="field-operations/process-flows" element={<PageLoader><ProcessFlowManagementPage /></PageLoader>} />
            <Route path="field-operations/visit-history" element={<PageLoader><VisitHistoryPage /></PageLoader>} />
            <Route path="field-operations/visit-management" element={<PageLoader><VisitManagementPage /></PageLoader>} />

            {/* Field Operations Refactor: New Routes */}
            <Route path="field-operations/performance" element={<PageLoader><FieldOpsPerformancePage /></PageLoader>} />
            <Route path="field-operations/daily-targets" element={<PageLoader><DailyTargetsPage /></PageLoader>} />
            <Route path="field-operations/individuals" element={<PageLoader><IndividualRegistrationPage /></PageLoader>} />
            <Route path="field-operations/companies" element={<PageLoader><CompanyManagementPage /></PageLoader>} />
            <Route path="field-operations/company-dashboard/:companyId" element={<PageLoader><CompanyDashboardPage /></PageLoader>} />
            <Route path="field-operations/hierarchy" element={<PageLoader><AgentHierarchyPage /></PageLoader>} />
            <Route path="field-operations/drill-down/:userId" element={<PageLoader><PerformanceDrillDownPage /></PageLoader>} />
            <Route path="field-operations/brand-insights" element={<PageLoader><BrandInsightsPage /></PageLoader>} />
            <Route path="field-operations/company-logins" element={<PageLoader><CompanyLoginsPage /></PageLoader>} />
            <Route path="field-operations/working-days" element={<PageLoader><WorkingDaysConfigPage /></PageLoader>} />
            <Route path="field-operations/monthly-targets" element={<PageLoader><MonthlyTargetsPage /></PageLoader>} />
            <Route path="field-operations/settings" element={<PageLoader><FieldOpsSettingsPage /></PageLoader>} />
            <Route path="field-operations/commission-tiers" element={<PageLoader><TargetCommissionsPage /></PageLoader>} />

            <Route path="field-marketing/*" element={<Navigate to="/field-operations" replace />} />

            {/* KYC Routes */}
            <Route path="kyc" element={<PageLoader><KYCDashboard /></PageLoader>} />
            <Route path="kyc/dashboard" element={<PageLoader><KYCDashboard /></PageLoader>} />
            <Route path="kyc/management" element={<PageLoader><KYCManagement /></PageLoader>} />
            <Route path="kyc/create" element={<PageLoader><KYCCreate /></PageLoader>} />
            <Route path="kyc/:id" element={<PageLoader><KYCDetail /></PageLoader>} />
            <Route path="kyc/:id/edit" element={<PageLoader><KYCEdit /></PageLoader>} />
            <Route path="kyc/reports" element={<PageLoader><KYCReports /></PageLoader>} />
            
            <Route path="kyc-surveys/*" element={<Navigate to="/kyc" replace />} />

            {/* Surveys Routes */}
            <Route path="surveys" element={<PageLoader><SurveysDashboard /></PageLoader>} />
            <Route path="surveys/dashboard" element={<PageLoader><SurveysDashboard /></PageLoader>} />
            <Route path="surveys/management" element={<PageLoader><SurveysManagement /></PageLoader>} />
            <Route path="surveys/create" element={<PageLoader><SurveyCreate /></PageLoader>} />
            <Route path="surveys/:id/edit" element={<PageLoader><SurveyEdit /></PageLoader>} />
            <Route path="surveys/:id/responses" element={<PageLoader><SurveyResponses /></PageLoader>} />
            <Route path="surveys/:id/analytics" element={<PageLoader><SurveyAnalytics /></PageLoader>} />

            {/* Inventory Routes */}
            <Route path="inventory" element={<PageLoader><InventoryDashboard /></PageLoader>} />
            <Route path="inventory/dashboard" element={<PageLoader><InventoryDashboard /></PageLoader>} />
            <Route path="inventory/stock-count" element={<PageLoader><StockCountWorkflowPage /></PageLoader>} />
            <Route path="inventory/stock-count/:id" element={<PageLoader><StockCountDetail /></PageLoader>} />
            <Route path="inventory/management" element={<PageLoader><InventoryManagement /></PageLoader>} />
            <Route path="inventory/reports" element={<PageLoader><InventoryReports /></PageLoader>} />
            <Route path="inventory/stock-levels" element={<PageLoader><InventoryManagement /></PageLoader>} />
            <Route path="inventory/movements" element={<PageLoader><InventoryReports /></PageLoader>} />
            <Route path="inventory/warehouses" element={<PageLoader><InventoryManagement /></PageLoader>} />
            <Route path="inventory/adjustments" element={<PageLoader><AdjustmentsList /></PageLoader>} />
            <Route path="inventory/adjustments/create" element={<PageLoader><AdjustmentCreate /></PageLoader>} />
            <Route path="inventory/adjustments/:id" element={<PageLoader><AdjustmentDetail /></PageLoader>} />
            <Route path="inventory/issues" element={<PageLoader><IssuesList /></PageLoader>} />
            <Route path="inventory/issues/create" element={<PageLoader><IssueCreate /></PageLoader>} />
            <Route path="inventory/issues/:id" element={<PageLoader><IssueDetail /></PageLoader>} />
            <Route path="inventory/receipts" element={<PageLoader><ReceiptsList /></PageLoader>} />
            <Route path="inventory/receipts/create" element={<PageLoader><ReceiptCreate /></PageLoader>} />
            <Route path="inventory/receipts/:id" element={<PageLoader><ReceiptDetail /></PageLoader>} />
            <Route path="inventory/stock-counts" element={<PageLoader><StockCountsList /></PageLoader>} />
            <Route path="inventory/stock-counts/create" element={<PageLoader><StockCountCreate /></PageLoader>} />
            <Route path="inventory/stock-counts/:id" element={<PageLoader><StockCountDetail /></PageLoader>} />
            <Route path="inventory/transfers" element={<PageLoader><TransfersList /></PageLoader>} />
            <Route path="inventory/transfers/create" element={<PageLoader><TransferCreate /></PageLoader>} />
            <Route path="inventory/transfers/:id" element={<PageLoader><TransferDetail /></PageLoader>} />
            
            <Route path="inventory-management/*" element={<Navigate to="/inventory" replace />} />

            {/* Promotions Routes */}
            <Route path="promotions" element={<PageLoader><PromotionsDashboard /></PageLoader>} />
            <Route path="promotions/dashboard" element={<PageLoader><PromotionsDashboard /></PageLoader>} />
            <Route path="promotions/management" element={<PageLoader><PromotionsManagement /></PageLoader>} />

            {/* Trade Marketing Routes */}
            <Route path="trade-marketing" element={<PageLoader><TradeMarketingPage /></PageLoader>} />
            <Route path="trade-marketing/activation" element={<PageLoader><ActivationWorkflowPage /></PageLoader>} />
            <Route path="trade-marketing/campaigns" element={<PageLoader><CampaignManagementPage /></PageLoader>} />
            <Route path="trade-marketing/campaigns/create" element={<PageLoader><TMCampaignCreate /></PageLoader>} />
            <Route path="trade-marketing/campaigns/:id" element={<PageLoader><TMCampaignDetail /></PageLoader>} />
            <Route path="trade-marketing/campaigns/:id/edit" element={<PageLoader><TMCampaignEdit /></PageLoader>} />
            <Route path="trade-marketing/merchandising" element={<PageLoader><MerchandisingCompliancePage /></PageLoader>} />
            <Route path="trade-marketing/promoters" element={<PageLoader><PromoterManagementPage /></PageLoader>} />
            <Route path="trade-marketing/promoters/create" element={<PageLoader><PromoterCreate /></PageLoader>} />
            <Route path="trade-marketing/promoters/:id" element={<PageLoader><PromoterDetail /></PageLoader>} />
            <Route path="trade-marketing/promoters/:id/edit" element={<PageLoader><PromoterEdit /></PageLoader>} />
            <Route path="trade-marketing/analytics" element={<PageLoader><TradeMarketingAnalyticsPage /></PageLoader>} />

            {/* Events Routes */}
            <Route path="events" element={<PageLoader><EventsPage /></PageLoader>} />

            {/* Campaign Routes */}
            <Route path="campaigns" element={<PageLoader><CampaignsPage /></PageLoader>} />
            
            {/* Brand Activations Routes */}
            <Route path="brand-activations" element={<PageLoader><BrandActivationsPage /></PageLoader>} />
            
            {/* Marketing index redirect */}
            <Route path="marketing" element={<Navigate to="/marketing/campaigns" replace />} />

            {/* Superadmin Routes */}
            <Route path="superadmin" element={<Navigate to="/superadmin/tenants" replace />} />
            <Route path="superadmin/tenants" element={<ProtectedRoute requiredRole="super_admin"><PageLoader><TenantManagement /></PageLoader></ProtectedRoute>} />
            <Route path="superadmin/tenants/:tenantId/modules" element={<ProtectedRoute requiredRole="super_admin"><PageLoader><TenantModules /></PageLoader></ProtectedRoute>} />

            <Route path="field-agents/*" element={<Navigate to="/field-operations" replace />} />

            {/* Business Routes */}
            <Route path="customers" element={<PageLoader><CustomersPage /></PageLoader>} />
            <Route path="customers/dashboard" element={<PageLoader><CustomerDashboard /></PageLoader>} />
            <Route path="customers/create" element={<PageLoader><CustomerCreatePage /></PageLoader>} />
            <Route path="customers/:id" element={<PageLoader><CustomerDetailsPage /></PageLoader>} />
            <Route path="customers/:id/edit" element={<PageLoader><CustomerEditPage /></PageLoader>} />
            <Route path="customers/:id/orders" element={<PageLoader><CustomerOrders /></PageLoader>} />
            <Route path="customers/:id/visits" element={<PageLoader><CustomerVisits /></PageLoader>} />
            <Route path="customers/:id/payments" element={<PageLoader><CustomerPayments /></PageLoader>} />
            <Route path="customers/:id/surveys" element={<PageLoader><CustomerSurveys /></PageLoader>} />
            <Route path="customers/credit" element={<PageLoader><CreditManagementPage /></PageLoader>} />
            <Route path="customers/:id/kyc" element={<PageLoader><CustomerKYC /></PageLoader>} />
            <Route path="orders" element={<PageLoader><OrdersPage /></PageLoader>} />
            <Route path="orders/dashboard" element={<PageLoader><OrderDashboard /></PageLoader>} />
            <Route path="orders/create" element={<PageLoader><OrderCreatePage /></PageLoader>} />
            <Route path="orders/:id" element={<PageLoader><OrderDetailsPage /></PageLoader>} />
            <Route path="orders/:id/edit" element={<PageLoader><OrderEditPage /></PageLoader>} />
            <Route path="orders/:id/items" element={<PageLoader><OrderItems /></PageLoader>} />
            <Route path="orders/:id/payments" element={<PageLoader><OrderPayments /></PageLoader>} />
            <Route path="orders/:id/delivery" element={<PageLoader><OrderDelivery /></PageLoader>} />
            <Route path="orders/:id/returns" element={<PageLoader><OrderReturns /></PageLoader>} />
            <Route path="products" element={<PageLoader><ProductsPage /></PageLoader>} />
            <Route path="products/create" element={<PageLoader><ProductCreatePage /></PageLoader>} />
            <Route path="products/:id" element={<PageLoader><ProductDetailsPage /></PageLoader>} />
            <Route path="products/:id/edit" element={<PageLoader><ProductEditPage /></PageLoader>} />
            <Route path="products/:id/inventory" element={<PageLoader><ProductInventory /></PageLoader>} />
            <Route path="products/:id/pricing" element={<PageLoader><ProductPricing /></PageLoader>} />
            <Route path="products/:id/promotions" element={<PageLoader><ProductPromotions /></PageLoader>} />
            <Route path="products/:id/sales" element={<PageLoader><ProductSales /></PageLoader>} />
            <Route path="brands" element={<PageLoader><BrandsList /></PageLoader>} />
            <Route path="brands/create" element={<PageLoader><BrandCreate /></PageLoader>} />
            <Route path="brands/:id" element={<PageLoader><BrandDetail /></PageLoader>} />
            <Route path="brands/:id/edit" element={<PageLoader><BrandEdit /></PageLoader>} />
            <Route path="brands/:id/surveys" element={<PageLoader><BrandSurveys /></PageLoader>} />
            <Route path="brands/:id/activations" element={<PageLoader><BrandActivations /></PageLoader>} />
            <Route path="brands/:id/boards" element={<PageLoader><BrandBoards /></PageLoader>} />
            <Route path="brands/:id/products" element={<PageLoader><BrandProducts /></PageLoader>} />
            
            <Route path="customer-management/*" element={<Navigate to="/customers" replace />} />
            
            {/* Product Management Routes */}
            <Route path="product-management/list" element={<PageLoader><ProductListPage /></PageLoader>} />
            <Route path="product-management/analytics" element={<PageLoader><ProductAnalyticsPage /></PageLoader>} />
            <Route path="product-management/hierarchy" element={<PageLoader><ProductHierarchyPage /></PageLoader>} />
            <Route path="product-management/import-export" element={<PageLoader><ProductImportExportPage /></PageLoader>} />
            <Route path="product-management/inventory" element={<PageLoader><ProductInventoryPage /></PageLoader>} />
            <Route path="product-management/pricing" element={<PageLoader><ProductPricingPage /></PageLoader>} />
            
            <Route path="order-lifecycle/*" element={<Navigate to="/sales" replace />} />

            {/* Sales Routes */}
            <Route path="sales" element={<PageLoader><SalesDashboard /></PageLoader>} />
            <Route path="sales/dashboard" element={<PageLoader><SalesDashboard /></PageLoader>} />
            <Route path="sales/orders" element={<PageLoader><SalesOrdersList /></PageLoader>} />
            <Route path="sales/orders/create" element={<PageLoader><SalesOrderCreate /></PageLoader>} />
            <Route path="sales/orders/:id" element={<PageLoader><SalesOrderDetail /></PageLoader>} />
            <Route path="sales/orders/:id/edit" element={<PageLoader><SalesOrderEdit /></PageLoader>} />
            <Route path="sales/invoices" element={<PageLoader><InvoicesList /></PageLoader>} />
            <Route path="sales/invoices/create" element={<PageLoader><InvoiceCreate /></PageLoader>} />
            <Route path="sales/invoices/:id" element={<PageLoader><InvoiceDetail /></PageLoader>} />
            <Route path="sales/payments" element={<PageLoader><PaymentsList /></PageLoader>} />
            <Route path="sales/payments/create" element={<PageLoader><PaymentCreate /></PageLoader>} />
            <Route path="sales/payments/:id" element={<PageLoader><PaymentDetail /></PageLoader>} />
            <Route path="sales/credit-notes" element={<PageLoader><CreditNotesList /></PageLoader>} />
            <Route path="sales/credit-notes/create" element={<PageLoader><CreditNoteCreate /></PageLoader>} />
            <Route path="sales/credit-notes/:id" element={<PageLoader><CreditNoteDetail /></PageLoader>} />
            <Route path="sales/returns" element={<PageLoader><SalesReturnsList /></PageLoader>} />
            <Route path="sales/returns/create" element={<PageLoader><SalesReturnCreate /></PageLoader>} />
            <Route path="sales/returns/:id" element={<PageLoader><SalesReturnDetail /></PageLoader>} />

            {/* Marketing Routes */}
            <Route path="marketing/campaigns" element={<PageLoader><CampaignsList /></PageLoader>} />
            <Route path="marketing/campaigns/create" element={<PageLoader><CampaignCreate /></PageLoader>} />
            <Route path="marketing/campaigns/:id" element={<PageLoader><CampaignDetail /></PageLoader>} />
            <Route path="marketing/campaigns/:id/edit" element={<PageLoader><CampaignEdit /></PageLoader>} />
            <Route path="marketing/events" element={<PageLoader><EventsList /></PageLoader>} />
            <Route path="marketing/events/create" element={<PageLoader><EventCreate /></PageLoader>} />
            <Route path="marketing/events/:id" element={<PageLoader><EventDetail /></PageLoader>} />
            <Route path="marketing/events/:id/edit" element={<PageLoader><EventEdit /></PageLoader>} />
            <Route path="marketing/hierarchy" element={<PageLoader><MarketingHierarchyPage /></PageLoader>} />
            <Route path="marketing/activations" element={<PageLoader><ActivationsList /></PageLoader>} />
            <Route path="marketing/activations/create" element={<PageLoader><ActivationCreate /></PageLoader>} />
            <Route path="marketing/activations/:id" element={<PageLoader><ActivationDetail /></PageLoader>} />
            <Route path="marketing/promotions" element={<PageLoader><PromotionsList /></PageLoader>} />
            <Route path="marketing/promotions/create" element={<PageLoader><PromotionCreate /></PageLoader>} />
            <Route path="marketing/promotions/:id" element={<PageLoader><PromotionDetail /></PageLoader>} />

            <Route path="crm/*" element={<Navigate to="/customers" replace />} />

            {/* Finance Routes */}
            <Route path="finance" element={<PageLoader><FinanceDashboard /></PageLoader>} />
            <Route path="finance/dashboard" element={<PageLoader><FinanceDashboard /></PageLoader>} />
            <Route path="finance/invoices" element={<PageLoader><InvoiceManagementPage /></PageLoader>} />
            <Route path="finance/invoices/create" element={<PageLoader><FinanceInvoiceCreate /></PageLoader>} />
            <Route path="finance/invoices/:id" element={<PageLoader><FinanceInvoiceDetail /></PageLoader>} />
            <Route path="finance/invoices/:id/edit" element={<PageLoader><FinanceInvoiceEdit /></PageLoader>} />
            <Route path="finance/invoices/:id/payments" element={<PageLoader><InvoicePayments /></PageLoader>} />
            <Route path="finance/invoices/:id/items" element={<PageLoader><InvoiceItems /></PageLoader>} />
            <Route path="finance/payments" element={<PageLoader><PaymentCollectionPage /></PageLoader>} />
            <Route path="finance/payments/create" element={<PageLoader><FinancePaymentCreate /></PageLoader>} />
            <Route path="finance/payments/:id" element={<PageLoader><FinancePaymentDetail /></PageLoader>} />
            <Route path="finance/payments/:id/edit" element={<PageLoader><FinancePaymentEdit /></PageLoader>} />
            <Route path="finance/cash-reconciliation" element={<PageLoader><CashReconciliationList /></PageLoader>} />
            <Route path="finance/cash-reconciliation/create" element={<PageLoader><CashReconciliationCreate /></PageLoader>} />
            <Route path="finance/cash-reconciliation/:id" element={<PageLoader><CashReconciliationDetail /></PageLoader>} />
            <Route path="finance/commission-payouts" element={<PageLoader><CommissionPayoutsList /></PageLoader>} />
            <Route path="finance/commission-payouts/:id" element={<PageLoader><CommissionPayoutDetail /></PageLoader>} />
            
            <Route path="cash-reconciliation/*" element={<Navigate to="/finance/cash-reconciliation" replace />} />
            
            {/* Commission Routes */}
            <Route path="commissions" element={<PageLoader><CommissionDashboardPage /></PageLoader>} />
            <Route path="commissions/create" element={<PageLoader><CommissionCreate /></PageLoader>} />
            <Route path="commissions/:id" element={<PageLoader><CommissionDetail /></PageLoader>} />
            <Route path="commissions/:id/edit" element={<PageLoader><CommissionEdit /></PageLoader>} />
            <Route path="commissions/calculation" element={<PageLoader><CommissionCalculationPage /></PageLoader>} />
            <Route path="commissions/approval" element={<PageLoader><CommissionApprovalPage /></PageLoader>} />
            <Route path="commissions/payment" element={<PageLoader><CommissionPaymentPage /></PageLoader>} />
            <Route path="commissions/reports" element={<PageLoader><CommissionReportsPage /></PageLoader>} />
            <Route path="commissions/settings" element={<PageLoader><CommissionSettingsPage /></PageLoader>} />
            <Route path="commissions/rules/create" element={<PageLoader><RuleCreate /></PageLoader>} />
            <Route path="commissions/rules/:id" element={<PageLoader><RuleDetail /></PageLoader>} />
            <Route path="commissions/rules/:id/edit" element={<PageLoader><RuleEdit /></PageLoader>} />

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
                <AdminCampaignManagementPage />
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
            <Route path="admin/role-management" element={
              <ProtectedRoute requiredRole="admin">
                <RoleManagementPage />
              </ProtectedRoute>
            } />
            <Route path="admin/company-setup" element={
              <ProtectedRoute requiredRole="admin">
                <CompanySetupPage />
              </ProtectedRoute>
            } />

            {/* Insights Dashboard Routes */}
            <Route path="insights" element={<PageLoader><ExecutiveInsightsDashboard /></PageLoader>} />
            <Route path="insights/executive" element={<PageLoader><ExecutiveInsightsDashboard /></PageLoader>} />
            <Route path="insights/sales" element={<PageLoader><SalesInsights /></PageLoader>} />
            <Route path="insights/van-sales" element={<PageLoader><VanSalesInsights /></PageLoader>} />
            <Route path="insights/field-ops" element={<PageLoader><FieldOpsInsights /></PageLoader>} />
            <Route path="insights/trade-promotions" element={<PageLoader><TradePromoInsights /></PageLoader>} />
            <Route path="insights/trade-promos" element={<Navigate to="/insights/trade-promotions" replace />} />
            <Route path="insights/stock" element={<PageLoader><StockInsights /></PageLoader>} />
            <Route path="insights/commissions" element={<PageLoader><CommissionInsights /></PageLoader>} />
            <Route path="insights/goals" element={<PageLoader><GoalsInsights /></PageLoader>} />
            <Route path="insights/anomalies" element={<PageLoader><AnomalyInsights /></PageLoader>} />
            <Route path="insights/share-of-voice" element={<PageLoader><ShareOfVoiceInsights /></PageLoader>} />
            <Route path="insights/competitors" element={<PageLoader><CompetitorInsights /></PageLoader>} />
            <Route path="brand-owner/dashboard" element={<PageLoader><BrandOwnerDashboard /></PageLoader>} />
            <Route path="brand-owner/reports" element={<PageLoader><BrandOwnerReports /></PageLoader>} />


            {/* BUG-007: Previously unrouted drill-down pages */}
            <Route path="inventory/adjustments/:id/items/:itemId" element={<PageLoader><AdjustmentItemDetail /></PageLoader>} />
            <Route path="inventory/adjustments/:id/items/:itemId/edit" element={<PageLoader><AdjustmentItemEdit /></PageLoader>} />
            <Route path="inventory/adjustments/:id/items" element={<PageLoader><AdjustmentItemList /></PageLoader>} />
            <Route path="inventory/adjustments/:id/justification" element={<PageLoader><AdjustmentJustification /></PageLoader>} />
            <Route path="commissions/approvals/:id" element={<PageLoader><ApprovalDetail /></PageLoader>} />
            <Route path="inventory/batches/:id/allocation" element={<PageLoader><BatchAllocation /></PageLoader>} />
            <Route path="inventory/batches/:id" element={<PageLoader><BatchDetail /></PageLoader>} />
            <Route path="inventory/batches/expiry" element={<PageLoader><BatchExpiry /></PageLoader>} />
            <Route path="inventory/batches/:id/movements" element={<PageLoader><BatchMovementHistory /></PageLoader>} />
            <Route path="field-operations/boards/:id/compliance" element={<PageLoader><BoardComplianceChecks /></PageLoader>} />
            <Route path="field-operations/boards/:id/location-changes" element={<PageLoader><BoardLocationChanges /></PageLoader>} />
            <Route path="field-operations/boards/:id/maintenance" element={<PageLoader><BoardMaintenanceLog /></PageLoader>} />
            <Route path="field-operations/boards/:id/photos" element={<PageLoader><BoardPhotoHistory /></PageLoader>} />
            <Route path="field-operations/boards/:id/history" element={<PageLoader><BoardPlacementHistory /></PageLoader>} />
            <Route path="field-operations/brand-activation" element={<PageLoader><BrandActivationFormPage /></PageLoader>} />
            <Route path="commissions/calculations/:id" element={<PageLoader><CalculationDetail /></PageLoader>} />
            <Route path="commissions/calculations/:id/log" element={<PageLoader><CalculationLog /></PageLoader>} />
            <Route path="van-sales/cash-reconciliation/:sessionId/variance" element={<PageLoader><CashVariance /></PageLoader>} />
            <Route path="van-sales/cash-reconciliation/:sessionId/collections/:collectionId" element={<PageLoader><CollectionDetail /></PageLoader>} />
            <Route path="inventory/stock-counts/:countId/lines/:lineId/approval" element={<PageLoader><CountLineApproval /></PageLoader>} />
            <Route path="inventory/stock-counts/:countId/lines/:lineId" element={<PageLoader><CountLineDetail /></PageLoader>} />
            <Route path="inventory/stock-counts/:countId/lines/:lineId/edit" element={<PageLoader><CountLineEdit /></PageLoader>} />
            <Route path="inventory/stock-counts/:countId/lines" element={<PageLoader><CountLineList /></PageLoader>} />
            <Route path="customer-selection" element={<PageLoader><CustomerSelectionPage /></PageLoader>} />
            <Route path="customers/advanced" element={<PageLoader><CustomersAdvanced /></PageLoader>} />
            <Route path="orders/:id/deliveries/:deliveryId" element={<PageLoader><DeliveryDetail /></PageLoader>} />
            <Route path="orders/:id/deliveries/:deliveryId/edit" element={<PageLoader><DeliveryEdit /></PageLoader>} />
            <Route path="orders/:id/deliveries" element={<PageLoader><DeliveryList /></PageLoader>} />
            <Route path="orders/:id/deliveries/:deliveryId/pod" element={<PageLoader><DeliveryPOD /></PageLoader>} />
            <Route path="orders/:id/deliveries/:deliveryId/stops/:stopId" element={<PageLoader><DeliveryStopDetail /></PageLoader>} />
            <Route path="orders/:id/deliveries/:deliveryId/stops" element={<PageLoader><DeliveryStops /></PageLoader>} />
            <Route path="van-sales/cash-reconciliation/:sessionId/deposits/:depositId" element={<PageLoader><DepositDetail /></PageLoader>} />
            <Route path="commissions/exceptions/:id" element={<PageLoader><ExceptionDetail /></PageLoader>} />
            <Route path="field-operations/visits/:id/board-placement" element={<PageLoader><FOBoardPlacementDetail /></PageLoader>} />
            <Route path="field-operations/visits/:id/product-distribution" element={<PageLoader><FOProductDistributionDetail /></PageLoader>} />
            <Route path="field-operations/visits/:id/survey" element={<PageLoader><FOSurveyDetail /></PageLoader>} />
            <Route path="field-operations/visits/:id/tasks/:taskId" element={<PageLoader><FOVisitTaskDetail /></PageLoader>} />
            <Route path="field-operations/visits/:id/tasks/:taskId/edit" element={<PageLoader><FOVisitTaskEdit /></PageLoader>} />
            <Route path="field-operations/visits/:id/tasks" element={<PageLoader><FOVisitTaskList /></PageLoader>} />
            <Route path="field-marketing/agent" element={<PageLoader><FieldMarketingAgentPage /></PageLoader>} />
            <Route path="finance/invoices/:invoiceId/items/:itemId" element={<PageLoader><InvoiceItemDetail /></PageLoader>} />
            <Route path="finance/invoices/:invoiceId/items/:itemId/edit" element={<PageLoader><InvoiceItemEdit /></PageLoader>} />
            <Route path="finance/invoices/:invoiceId/items/:itemId/history" element={<PageLoader><InvoiceItemHistory /></PageLoader>} />
            <Route path="finance/invoices/:invoiceId/items-list" element={<PageLoader><InvoiceItemList /></PageLoader>} />
            <Route path="finance/invoices/:invoiceId/status-history" element={<PageLoader><InvoiceStatusHistory /></PageLoader>} />
            <Route path="inventory/lots/:id" element={<PageLoader><LotDetail /></PageLoader>} />
            <Route path="inventory/lots" element={<PageLoader><LotTracking /></PageLoader>} />
            <Route path="inventory/stock-ledger/movements/:id" element={<PageLoader><MovementDetail /></PageLoader>} />
            <Route path="orders/:id/items/:itemId" element={<PageLoader><OrderItemDetail /></PageLoader>} />
            <Route path="orders/:id/items/:itemId/edit" element={<PageLoader><OrderItemEdit /></PageLoader>} />
            <Route path="orders/:id/items/:itemId/history" element={<PageLoader><OrderItemHistory /></PageLoader>} />
            <Route path="orders/:id/items-list" element={<PageLoader><OrderItemList /></PageLoader>} />
            <Route path="orders/:id/status-history" element={<PageLoader><OrderStatusHistory /></PageLoader>} />
            <Route path="orders/kanban" element={<PageLoader><OrdersKanban /></PageLoader>} />
            <Route path="field-operations/pos-tracker" element={<PageLoader><POSMaterialTrackerPage /></PageLoader>} />
            <Route path="finance/payments/:paymentId/allocations/create" element={<PageLoader><PaymentAllocationCreate /></PageLoader>} />
            <Route path="finance/payments/:paymentId/allocations/:allocId" element={<PageLoader><PaymentAllocationDetail /></PageLoader>} />
            <Route path="finance/payments/:paymentId/allocations/:allocId/edit" element={<PageLoader><PaymentAllocationEdit /></PageLoader>} />
            <Route path="finance/payments/:paymentId/allocations" element={<PageLoader><PaymentAllocationList /></PageLoader>} />
            <Route path="finance/payments/:paymentId/status-history" element={<PageLoader><PaymentStatusHistory /></PageLoader>} />
            <Route path="commissions/payouts/:payoutId/audit" element={<PageLoader><PayoutAuditTrail /></PageLoader>} />
            <Route path="commissions/payouts/:payoutId/lines/:lineId" element={<PageLoader><PayoutLineDetail /></PageLoader>} />
            <Route path="commissions/payouts/:payoutId/lines/:lineId/edit" element={<PageLoader><PayoutLineEdit /></PageLoader>} />
            <Route path="commissions/payouts/:payoutId/lines" element={<PageLoader><PayoutLineList /></PageLoader>} />
            <Route path="field-operations/photos/:id" element={<PageLoader><PhotoDetail /></PageLoader>} />
            <Route path="field-operations/photos/:id/evidence" element={<PageLoader><PhotoEvidence /></PageLoader>} />
            <Route path="field-operations/photos" element={<PageLoader><PhotoGallery /></PageLoader>} />
            <Route path="field-operations/photos/timeline" element={<PageLoader><PhotoTimeline /></PageLoader>} />
            <Route path="orders/:id/return-items/:itemId/approval" element={<PageLoader><ReturnItemApproval /></PageLoader>} />
            <Route path="orders/:id/return-items/:itemId" element={<PageLoader><ReturnItemDetail /></PageLoader>} />
            <Route path="orders/:id/return-items/:itemId/edit" element={<PageLoader><ReturnItemEdit /></PageLoader>} />
            <Route path="orders/:id/return-items" element={<PageLoader><ReturnItemList /></PageLoader>} />
            <Route path="van-sales/routes/:routeId/stops/:stopId" element={<PageLoader><RouteStopDetail /></PageLoader>} />
            <Route path="van-sales/routes/:routeId/stops/:stopId/edit" element={<PageLoader><RouteStopEdit /></PageLoader>} />
            <Route path="van-sales/routes/:routeId/stops/exceptions" element={<PageLoader><RouteStopExceptions /></PageLoader>} />
            <Route path="van-sales/routes/:routeId/stops" element={<PageLoader><RouteStopList /></PageLoader>} />
            <Route path="van-sales/routes/:routeId/stops/performance" element={<PageLoader><RouteStopPerformance /></PageLoader>} />
            <Route path="commissions/rules/:id/conditions" element={<PageLoader><RuleConditionDetail /></PageLoader>} />
            <Route path="field-operations/sku-checker" element={<PageLoader><SKUAvailabilityCheckerPage /></PageLoader>} />
            <Route path="inventory/serials/:id" element={<PageLoader><SerialDetail /></PageLoader>} />
            <Route path="inventory/serials" element={<PageLoader><SerialTracking /></PageLoader>} />
            <Route path="field-operations/shelf-analytics" element={<PageLoader><ShelfAnalyticsFormPage /></PageLoader>} />
            <Route path="commissions/payouts/:payoutId/transactions" element={<PageLoader><SourceTransactions /></PageLoader>} />
            <Route path="orders/:id/status-history/:transitionId" element={<PageLoader><StatusTransitionDetail /></PageLoader>} />
            <Route path="inventory/stock-ledger/by-product" element={<PageLoader><StockLedgerByProduct /></PageLoader>} />
            <Route path="inventory/stock-ledger/by-warehouse" element={<PageLoader><StockLedgerByWarehouse /></PageLoader>} />
            <Route path="inventory/stock-ledger" element={<PageLoader><StockLedgerDetail /></PageLoader>} />
            <Route path="field-operations/surveys/:id/analysis" element={<PageLoader><SurveyAnalysis /></PageLoader>} />
            <Route path="field-operations/surveys/:id/answers/:answerId" element={<PageLoader><SurveyAnswerDetail /></PageLoader>} />
            <Route path="field-operations/surveys/comparison" element={<PageLoader><SurveyComparison /></PageLoader>} />
            <Route path="field-operations/surveys/:id/responses/:responseId" element={<PageLoader><SurveyResponseDetail /></PageLoader>} />
            <Route path="field-operations/surveys/:id/responses/:responseId/edit" element={<PageLoader><SurveyResponseEdit /></PageLoader>} />
            <Route path="trade-marketing/agent" element={<PageLoader><TradeMarketingAgentPage /></PageLoader>} />
            <Route path="inventory/transfers/:id/items/:itemId" element={<PageLoader><TransferItemDetail /></PageLoader>} />
            <Route path="inventory/transfers/:id/items/:itemId/edit" element={<PageLoader><TransferItemEdit /></PageLoader>} />
            <Route path="inventory/transfers/:id/items" element={<PageLoader><TransferItemList /></PageLoader>} />
            <Route path="inventory/transfers/:id/tracking" element={<PageLoader><TransferItemTracking /></PageLoader>} />
            <Route path="van-sales/van-loads/:loadId/items/:itemId" element={<PageLoader><VanLoadItemDetail /></PageLoader>} />
            <Route path="van-sales/van-loads/:loadId/items/:itemId/edit" element={<PageLoader><VanLoadItemEdit /></PageLoader>} />
            <Route path="van-sales/van-loads/:loadId/items" element={<PageLoader><VanLoadItemList /></PageLoader>} />
            <Route path="van-sales/van-loads/:loadId/reconciliation" element={<PageLoader><VanLoadReconciliation /></PageLoader>} />
            <Route path="van-sales/van-loads/:loadId/variance" element={<PageLoader><VanLoadVariance /></PageLoader>} />
            <Route path="inventory/stock-counts/:countId/variance" element={<PageLoader><VarianceResolution /></PageLoader>} />
            <Route path="field-operations/visit-workflow" element={<PageLoader><VisitWorkflowPage /></PageLoader>} />
            <Route path="field-operations/board-placements" element={<PageLoader><BoardPlacementsList /></PageLoader>} />
            <Route path="field-operations/board-placements/create" element={<PageLoader><BoardPlacementCreate /></PageLoader>} />
            <Route path="field-operations/board-placements/:id" element={<PageLoader><BoardPlacementDetail /></PageLoader>} />
            <Route path="field-operations/product-distributions" element={<PageLoader><ProductDistributionsList /></PageLoader>} />
            <Route path="field-operations/product-distributions/create" element={<PageLoader><ProductDistributionCreate /></PageLoader>} />
            <Route path="field-operations/product-distributions/:id" element={<PageLoader><ProductDistributionDetail /></PageLoader>} />
            <Route path="field-operations/commission" element={<PageLoader><CommissionLedgerList /></PageLoader>} />
            <Route path="field-operations/commission/:id" element={<PageLoader><CommissionLedgerDetail /></PageLoader>} />
            <Route path="agent/pin-management" element={<PageLoader><AgentPinManagement /></PageLoader>} />
            <Route path="analytics-dashboard/*" element={<PageLoader><AnalyticsDashboardPage /></PageLoader>} />
            <Route path="van-sales/route-management" element={<PageLoader><RouteManagementPage /></PageLoader>} />
            <Route path="van-sales/orders-list" element={<PageLoader><VanOrdersListPage /></PageLoader>} />
            <Route path="van-sales/route-details/:id" element={<PageLoader><VanRouteDetailsPage /></PageLoader>} />
            <Route path="van-sales/workflow" element={<PageLoader><VanSalesWorkflowPage /></PageLoader>} />
            <Route path="field-operations/visits/list" element={<PageLoader><VisitsList /></PageLoader>} />

            {/* Field Operations Reports (SSReports-style) */}
            <Route path="field-operations/reports" element={<PageLoader><ReportsDashboard /></PageLoader>} />
            <Route path="field-operations/reports/dashboard" element={<PageLoader><ReportsDashboard /></PageLoader>} />
            <Route path="field-operations/reports/insights" element={<PageLoader><ReportsInsights /></PageLoader>} />
            <Route path="field-operations/reports/shops" element={<PageLoader><ReportsShopsAnalytics /></PageLoader>} />
            <Route path="field-operations/reports/customers" element={<PageLoader><ReportsCustomersAnalytics /></PageLoader>} />
            <Route path="field-operations/reports/checkins" element={<PageLoader><ReportsCheckinsList /></PageLoader>} />
            <Route path="field-operations/reports/export" element={<PageLoader><ReportsExport /></PageLoader>} />

            {/* Mobile More Menu */}
            <Route path="mobile-dashboard" element={<PageLoader><MobileDashboard /></PageLoader>} />
            <Route path="more" element={<PageLoader><MoreMenuPage /></PageLoader>} />

            {/* Default redirect */}
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Agent Routes - separate layout without admin chrome */}
          <Route path="/agent" element={
            <ProtectedRoute>
              <PageLoader><AgentLayout /></PageLoader>
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<PageLoader><AgentDashboard /></PageLoader>} />
            <Route path="visits" element={<PageLoader><AgentVisits /></PageLoader>} />
            <Route path="visits/create" element={<PageLoader><VisitCreate /></PageLoader>} />
            <Route path="visits/:id" element={<PageLoader><VisitDetail /></PageLoader>} />
            <Route path="visits/:id/edit" element={<PageLoader><VisitEdit /></PageLoader>} />
            <Route path="stats" element={<PageLoader><AgentStats /></PageLoader>} />
            <Route path="team" element={<PageLoader><TeamTab /></PageLoader>} />
            <Route path="teams" element={<PageLoader><ManagerTeamsTab /></PageLoader>} />
            <Route path="profile" element={<PageLoader><AgentProfile /></PageLoader>} />
            <Route path="onboarding" element={<PageLoader><AgentOnboarding /></PageLoader>} />
            <Route path="training" element={<PageLoader><AgentTrainingGuide /></PageLoader>} />
            <Route index element={<PageLoader><AgentDashboard /></PageLoader>} />
          </Route>

          {/* T-17: 404 Not Found page */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}

export default App
