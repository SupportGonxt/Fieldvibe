import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'
import { useEffect } from 'react'
import AuthLayout from './components/layout/AuthLayout'
import DashboardLayout from './components/layout/DashboardLayout'
import ErrorBoundary from './components/ui/ErrorBoundary'
import LoadingSpinner from './components/ui/LoadingSpinner'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LandingPage from './pages/marketing/LandingPage'
import { lazy, Suspense } from 'react'

// Lazy-loaded page components for code splitting
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'))
const AnalyticsPage = lazy(() => import('./pages/dashboard/AnalyticsPage'))
const VanSalesPage = lazy(() => import('./pages/van-sales/VanSalesPage'))
const VanSalesDashboard = lazy(() => import('./pages/van-sales/VanSalesDashboard'))
const VanSalesWorkflowPage = lazy(() => import('./pages/van-sales/VanSalesWorkflowPage'))
const RouteManagementPage = lazy(() => import('./pages/van-sales/RouteManagementPage'))
const InventoryTrackingPage = lazy(() => import('./pages/van-sales/InventoryTrackingPage'))
const TradeMarketingPage = lazy(() => import('./pages/trade-marketing/TradeMarketingPage'))
const ActivationWorkflowPage = lazy(() => import('./pages/trade-marketing/ActivationWorkflowPage'))
const CampaignManagementPage = lazy(() => import('./pages/trade-marketing/CampaignManagementPage'))
const MerchandisingCompliancePage = lazy(() => import('./pages/trade-marketing/MerchandisingCompliancePage'))
const PromoterManagementPage = lazy(() => import('./pages/trade-marketing/PromoterManagementPage'))
const TradeMarketingAnalyticsPage = lazy(() => import('./pages/trade-marketing/TradeMarketingAnalyticsPage'))
const EventsPage = lazy(() => import('./pages/events/EventsPage'))
const CampaignsPage = lazy(() => import('./pages/campaigns/CampaignsPage'))
const FieldOperationsDashboard = lazy(() => import('./pages/field-operations/FieldOperationsDashboard'))
const VanSalesWorkflowPageMobile = lazy(() => import('./pages/van-sales/VanSalesWorkflowPageMobile'))
const BoardPlacementFormPage = lazy(() => import('./pages/field-operations/BoardPlacementFormPage'))
const ProductDistributionFormPage = lazy(() => import('./pages/field-operations/ProductDistributionFormPage'))
const KYCDashboard = lazy(() => import('./pages/kyc/KYCDashboard'))
const KYCManagement = lazy(() => import('./pages/kyc/KYCManagement'))
const KYCReports = lazy(() => import('./pages/kyc/KYCReports'))
const SurveysDashboard = lazy(() => import('./pages/surveys/SurveysDashboard'))
const SurveysManagement = lazy(() => import('./pages/surveys/SurveysManagement'))
const SurveyCreate = lazy(() => import('./pages/surveys/SurveyCreate'))
const SurveyEdit = lazy(() => import('./pages/surveys/SurveyEdit'))
const InventoryDashboard = lazy(() => import('./pages/inventory/InventoryDashboard'))
const InventoryManagement = lazy(() => import('./pages/inventory/InventoryManagement'))
const InventoryReports = lazy(() => import('./pages/inventory/InventoryReports'))
const StockCountWorkflowPage = lazy(() => import('./pages/inventory/StockCountWorkflowPage'))
const PromotionsDashboard = lazy(() => import('./pages/promotions/PromotionsDashboard'))
const PromotionsManagement = lazy(() => import('./pages/promotions/PromotionsManagement'))
const CustomersPage = lazy(() => import('./pages/customers/CustomersPage'))
const CustomerDetailsPage = lazy(() => import('./pages/customers/CustomerDetailsPage'))
const CustomerEditPage = lazy(() => import('./pages/customers/CustomerEditPage'))
const CustomerCreatePage = lazy(() => import('./pages/customers/CustomerCreatePage'))
const OrdersPage = lazy(() => import('./pages/orders/OrdersPage'))
const OrderDetailsPage = lazy(() => import('./pages/orders/OrderDetailsPage'))
const OrderEditPage = lazy(() => import('./pages/orders/OrderEditPage'))
const OrderCreatePage = lazy(() => import('./pages/orders/OrderCreatePage'))
const ProductsPage = lazy(() => import('./pages/products/ProductsPage'))
const ProductDetailsPage = lazy(() => import('./pages/products/ProductDetailsPage'))
const ProductEditPage = lazy(() => import('./pages/products/ProductEditPage'))
const ProductCreatePage = lazy(() => import('./pages/products/ProductCreatePage'))
const BrandsList = lazy(() => import('./pages/brands/BrandsList'))
const BrandDetail = lazy(() => import('./pages/brands/BrandDetail'))
const BrandEdit = lazy(() => import('./pages/brands/BrandEdit'))
const BrandCreate = lazy(() => import('./pages/brands/BrandCreate'))
const BrandSurveys = lazy(() => import('./pages/brands/BrandSurveys'))
const BrandActivations = lazy(() => import('./pages/brands/BrandActivations'))
const BrandBoards = lazy(() => import('./pages/brands/BrandBoards'))
const BrandProducts = lazy(() => import('./pages/brands/BrandProducts'))
const CustomerOrders = lazy(() => import('./pages/customers/tabs/CustomerOrders'))
const CustomerVisits = lazy(() => import('./pages/customers/tabs/CustomerVisits'))
const CustomerPayments = lazy(() => import('./pages/customers/tabs/CustomerPayments'))
const CustomerSurveys = lazy(() => import('./pages/customers/tabs/CustomerSurveys'))
const CustomerKYC = lazy(() => import('./pages/customers/tabs/CustomerKYC'))
const ProductInventory = lazy(() => import('./pages/products/tabs/ProductInventory'))
const ProductPricing = lazy(() => import('./pages/products/tabs/ProductPricing'))
const ProductPromotions = lazy(() => import('./pages/products/tabs/ProductPromotions'))
const ProductSales = lazy(() => import('./pages/products/tabs/ProductSales'))
const OrderItems = lazy(() => import('./pages/orders/tabs/OrderItems'))
const OrderPayments = lazy(() => import('./pages/orders/tabs/OrderPayments'))
const OrderDelivery = lazy(() => import('./pages/orders/tabs/OrderDelivery'))
const OrderReturns = lazy(() => import('./pages/orders/tabs/OrderReturns'))
const VanOrderCreatePage = lazy(() => import('./pages/van-sales/VanOrderCreatePage'))
const VanRouteDetailsPage = lazy(() => import('./pages/van-sales/VanRouteDetailsPage'))
const VanSalesOrderCreate = lazy(() => import('./pages/van-sales/orders/VanSalesOrderCreate'))
const VanSalesOrderDetail = lazy(() => import('./pages/van-sales/orders/VanSalesOrderDetail'))
const VanSalesOrderEdit = lazy(() => import('./pages/van-sales/orders/VanSalesOrderEdit'))
const VanSalesReturnCreate = lazy(() => import('./pages/van-sales/returns/VanSalesReturnCreate'))
const VanSalesReturnDetail = lazy(() => import('./pages/van-sales/returns/VanSalesReturnDetail'))
const VanLoadCreate = lazy(() => import('./pages/van-sales/van-loads/VanLoadCreate'))
const VanLoadDetail = lazy(() => import('./pages/van-sales/van-loads/VanLoadDetail'))
const VanCashReconciliationCreate = lazy(() => import('./pages/van-sales/cash-reconciliation/CashReconciliationCreate'))
const VanCashReconciliationDetail = lazy(() => import('./pages/van-sales/cash-reconciliation/CashReconciliationDetail'))
const RouteDetail = lazy(() => import('./pages/van-sales-depth/RouteDetail'))
const RouteEdit = lazy(() => import('./pages/van-sales-depth/RouteEdit'))
const RouteCreate = lazy(() => import('./pages/van-sales-depth/RouteCreate'))
const RouteCustomers = lazy(() => import('./pages/van-sales-depth/RouteCustomers'))
const RouteOrders = lazy(() => import('./pages/van-sales-depth/RouteOrders'))
const RoutePerformance = lazy(() => import('./pages/van-sales-depth/RoutePerformance'))
const CommissionDetail = lazy(() => import('./pages/commissions/CommissionDetail'))
const CommissionEdit = lazy(() => import('./pages/commissions/CommissionEdit'))
const CommissionCreate = lazy(() => import('./pages/commissions/CommissionCreate'))
const RuleDetail = lazy(() => import('./pages/commissions/RuleDetail'))
const RuleEdit = lazy(() => import('./pages/commissions/RuleEdit'))
const RuleCreate = lazy(() => import('./pages/commissions/RuleCreate'))
const KYCDetail = lazy(() => import('./pages/kyc/KYCDetail'))
const KYCEdit = lazy(() => import('./pages/kyc/KYCEdit'))
const KYCCreate = lazy(() => import('./pages/kyc/KYCCreate'))
const SurveyResponses = lazy(() => import('./pages/surveys/SurveyResponses'))
const SurveyAnalytics = lazy(() => import('./pages/surveys/SurveyAnalytics'))
const ReportDetail = lazy(() => import('./pages/reports/ReportDetail'))
const ReportEdit = lazy(() => import('./pages/reports/ReportEdit'))
const ReportCreate = lazy(() => import('./pages/reports/ReportCreate'))
const FinanceInvoiceDetail = lazy(() => import('./pages/finance/InvoiceDetail'))
const FinanceInvoiceEdit = lazy(() => import('./pages/finance/InvoiceEdit'))
const FinanceInvoiceCreate = lazy(() => import('./pages/finance/InvoiceCreate'))
const FinancePaymentDetail = lazy(() => import('./pages/finance/PaymentDetail'))
const FinancePaymentEdit = lazy(() => import('./pages/finance/PaymentEdit'))
const FinancePaymentCreate = lazy(() => import('./pages/finance/PaymentCreate'))
const InvoicePayments = lazy(() => import('./pages/finance/InvoicePayments'))
const InvoiceItems = lazy(() => import('./pages/finance/InvoiceItems'))
const AdjustmentCreate = lazy(() => import('./pages/inventory/adjustments/AdjustmentCreate'))
const AdjustmentDetail = lazy(() => import('./pages/inventory/adjustments/AdjustmentDetail'))
const IssueCreate = lazy(() => import('./pages/inventory/issues/IssueCreate'))
const IssueDetail = lazy(() => import('./pages/inventory/issues/IssueDetail'))
const ReceiptCreate = lazy(() => import('./pages/inventory/receipts/ReceiptCreate'))
const ReceiptDetail = lazy(() => import('./pages/inventory/receipts/ReceiptDetail'))
const StockCountCreate = lazy(() => import('./pages/inventory/stock-counts/StockCountCreate'))
const StockCountDetail = lazy(() => import('./pages/inventory/stock-counts/StockCountDetail'))
const TransferCreate = lazy(() => import('./pages/inventory/transfers/TransferCreate'))
const TransferDetail = lazy(() => import('./pages/inventory/transfers/TransferDetail'))
const CreditNoteCreate = lazy(() => import('./pages/sales/credit-notes/CreditNoteCreate'))
const CreditNoteDetail = lazy(() => import('./pages/sales/credit-notes/CreditNoteDetail'))
const InvoiceCreate = lazy(() => import('./pages/sales/invoices/InvoiceCreate'))
const InvoiceDetail = lazy(() => import('./pages/sales/invoices/InvoiceDetail'))
const SalesOrderCreate = lazy(() => import('./pages/sales/orders/SalesOrderCreate'))
const SalesOrderDetail = lazy(() => import('./pages/sales/orders/SalesOrderDetail'))
const SalesOrderEdit = lazy(() => import('./pages/sales/orders/SalesOrderEdit'))
const PaymentCreate = lazy(() => import('./pages/sales/payments/PaymentCreate'))
const PaymentDetail = lazy(() => import('./pages/sales/payments/PaymentDetail'))
const SalesReturnCreate = lazy(() => import('./pages/sales/returns/SalesReturnCreate'))
const SalesReturnDetail = lazy(() => import('./pages/sales/returns/SalesReturnDetail'))
const ActivationCreate = lazy(() => import('./pages/marketing/activations/ActivationCreate'))
const ActivationDetail = lazy(() => import('./pages/marketing/activations/ActivationDetail'))
const CampaignCreate = lazy(() => import('./pages/marketing/campaigns/CampaignCreate'))
const CampaignDetail = lazy(() => import('./pages/marketing/campaigns/CampaignDetail'))
const CampaignEdit = lazy(() => import('./pages/marketing/campaigns/CampaignEdit'))
const EventCreate = lazy(() => import('./pages/marketing/events/EventCreate'))
const EventDetail = lazy(() => import('./pages/marketing/events/EventDetail'))
const EventEdit = lazy(() => import('./pages/marketing/events/EventEdit'))
const PromotionCreate = lazy(() => import('./pages/marketing/promotions/PromotionCreate'))
const PromotionDetail = lazy(() => import('./pages/marketing/promotions/PromotionDetail'))
const BoardPlacementCreate = lazy(() => import('./pages/field-operations/board-placements/BoardPlacementCreate'))
const BoardPlacementDetail = lazy(() => import('./pages/field-operations/board-placements/BoardPlacementDetail'))
const CommissionLedgerDetail = lazy(() => import('./pages/field-operations/commission-ledger/CommissionLedgerDetail'))
const ProductDistributionCreate = lazy(() => import('./pages/field-operations/product-distributions/ProductDistributionCreate'))
const ProductDistributionDetail = lazy(() => import('./pages/field-operations/product-distributions/ProductDistributionDetail'))
const VisitCreate = lazy(() => import('./pages/field-operations/visits/VisitCreate'))
const VisitDetail = lazy(() => import('./pages/field-operations/visits/VisitDetail'))
const VisitEdit = lazy(() => import('./pages/field-operations/visits/VisitEdit'))
const VisitManagementPage = lazy(() => import('./pages/field-operations/VisitManagementPage'))
const VisitConfigurationPage = lazy(() => import('./pages/field-operations/VisitConfigurationPage'))
const CashReconciliationCreate = lazy(() => import('./pages/finance/cash-reconciliation/CashReconciliationCreate'))
const CashReconciliationDetail = lazy(() => import('./pages/finance/cash-reconciliation/CashReconciliationDetail'))
const CommissionPayoutDetail = lazy(() => import('./pages/finance/commission-payouts/CommissionPayoutDetail'))
const AdminPage = lazy(() => import('./pages/admin/AdminPage'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'))
const RolePermissionsPage = lazy(() => import('./pages/admin/RolePermissionsPage'))
const SystemSettingsPage = lazy(() => import('./pages/admin/SystemSettingsPage'))
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage'))
const SmokeTestPage = lazy(() => import('./pages/admin/SmokeTestPage'))
const RouteAuditPage = lazy(() => import('./pages/admin/RouteAuditPage'))
const BrandManagementPage = lazy(() => import('./pages/admin/BrandManagementPage'))
const AdminCampaignManagementPage = lazy(() => import('./pages/admin/CampaignManagementPage'))
const CommissionRuleBuilderPage = lazy(() => import('./pages/admin/CommissionRuleBuilderPage'))
const DataImportExportPage = lazy(() => import('./pages/admin/DataImportExportPage'))
const POSLibraryPage = lazy(() => import('./pages/admin/POSLibraryPage'))
const ProductTypeBuilderPage = lazy(() => import('./pages/admin/ProductTypeBuilderPage'))
const SurveyBuilderPage = lazy(() => import('./pages/admin/SurveyBuilderPage'))
const TerritoryManagementPage = lazy(() => import('./pages/admin/TerritoryManagementPage'))
const BoardManagementPage = lazy(() => import('./pages/admin/BoardManagementPage'))
const PriceListManagementPage = lazy(() => import('./pages/admin/PriceListManagementPage'))
const PriceListEditPage = lazy(() => import('./pages/admin/PriceListEditPage'))
const BackupManagementPage = lazy(() => import('./pages/admin-settings/BackupManagementPage').then(m => ({ default: m.BackupManagementPage })))
const IntegrationsPage = lazy(() => import('./pages/admin-settings/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })))
const SystemHealthPage = lazy(() => import('./pages/admin-settings/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })))
const InvoicesList = lazy(() => import('./pages/sales/invoices/InvoicesList'))
const PaymentsList = lazy(() => import('./pages/sales/payments/PaymentsList'))
const CreditNotesList = lazy(() => import('./pages/sales/credit-notes/CreditNotesList'))
const SalesReturnsList = lazy(() => import('./pages/sales/returns/SalesReturnsList'))
const SalesOrdersList = lazy(() => import('./pages/sales/orders/SalesOrdersList'))
const VanSalesOrdersList = lazy(() => import('./pages/van-sales/orders/VanSalesOrdersList'))
const VanSalesReturnsList = lazy(() => import('./pages/van-sales/returns/VanSalesReturnsList'))
const VanLoadsList = lazy(() => import('./pages/van-sales/van-loads/VanLoadsList'))
const VanCashReconciliationList = lazy(() => import('./pages/van-sales/cash-reconciliation/CashReconciliationList'))
const AdjustmentsList = lazy(() => import('./pages/inventory/adjustments/AdjustmentsList'))
const IssuesList = lazy(() => import('./pages/inventory/issues/IssuesList'))
const ReceiptsList = lazy(() => import('./pages/inventory/receipts/ReceiptsList'))
const StockCountsList = lazy(() => import('./pages/inventory/stock-counts/StockCountsList'))
const TransfersList = lazy(() => import('./pages/inventory/transfers/TransfersList'))
const CashReconciliationList = lazy(() => import('./pages/finance/cash-reconciliation/CashReconciliationList'))
const CommissionPayoutsList = lazy(() => import('./pages/finance/commission-payouts/CommissionPayoutsList'))
const FinanceDashboard = lazy(() => import('./pages/finance/FinanceDashboard'))
const InvoiceManagementPage = lazy(() => import('./pages/finance/InvoiceManagementPage'))
const PaymentCollectionPage = lazy(() => import('./pages/finance/PaymentCollectionPage'))
const CommissionApprovalPage = lazy(() => import('./pages/commissions/CommissionApprovalPage').then(m => ({ default: m.CommissionApprovalPage })))
const CommissionCalculationPage = lazy(() => import('./pages/commissions/CommissionCalculationPage').then(m => ({ default: m.CommissionCalculationPage })))
const CommissionDashboardPage = lazy(() => import('./pages/commissions/CommissionDashboardPage').then(m => ({ default: m.CommissionDashboardPage })))
const CommissionPaymentPage = lazy(() => import('./pages/commissions/CommissionPaymentPage').then(m => ({ default: m.CommissionPaymentPage })))
const CommissionReportsPage = lazy(() => import('./pages/commissions/CommissionReportsPage').then(m => ({ default: m.CommissionReportsPage })))
const CommissionSettingsPage = lazy(() => import('./pages/commissions/CommissionSettingsPage').then(m => ({ default: m.CommissionSettingsPage })))
const ActivationsList = lazy(() => import('./pages/marketing/activations/ActivationsList'))
const CampaignsList = lazy(() => import('./pages/marketing/campaigns/CampaignsList'))
const EventsList = lazy(() => import('./pages/marketing/events/EventsList'))
const PromotionsList = lazy(() => import('./pages/marketing/promotions/PromotionsList'))
const BoardPlacementsList = lazy(() => import('./pages/field-operations/board-placements/BoardPlacementsList'))
const CommissionLedgerList = lazy(() => import('./pages/field-operations/commission-ledger/CommissionLedgerList'))
const ProductDistributionsList = lazy(() => import('./pages/field-operations/product-distributions/ProductDistributionsList'))
const ProductAnalyticsPage = lazy(() => import('./pages/product-management/ProductAnalyticsPage').then(m => ({ default: m.ProductAnalyticsPage })))
const ProductHierarchyPage = lazy(() => import('./pages/product-management/ProductHierarchyPage').then(m => ({ default: m.ProductHierarchyPage })))
const ProductImportExportPage = lazy(() => import('./pages/product-management/ProductImportExportPage').then(m => ({ default: m.ProductImportExportPage })))
const ProductInventoryPage = lazy(() => import('./pages/product-management/ProductInventoryPage').then(m => ({ default: m.ProductInventoryPage })))
const ProductListPage = lazy(() => import('./pages/product-management/ProductListPage').then(m => ({ default: m.ProductListPage })))
const ProductPricingPage = lazy(() => import('./pages/product-management/ProductPricingPage').then(m => ({ default: m.ProductPricingPage })))
const AnalyticsDashboardPage = lazy(() => import('./pages/reports/AnalyticsDashboardPage'))
const ReportBuilderPage = lazy(() => import('./pages/reports/ReportBuilderPage'))
const ReportsHub = lazy(() => import('./pages/reports/ReportsHub'))
const ReportTemplatesPage = lazy(() => import('./pages/reports/ReportTemplatesPage'))
const CommissionSummaryReport = lazy(() => import('./pages/reports/finance/CommissionSummaryReport'))
const InventorySnapshotReport = lazy(() => import('./pages/reports/inventory/InventorySnapshotReport'))
const VarianceAnalysisReport = lazy(() => import('./pages/reports/inventory/VarianceAnalysisReport'))
const FieldOperationsProductivityReport = lazy(() => import('./pages/reports/operations/FieldOperationsProductivityReport'))
const SalesExceptionsReport = lazy(() => import('./pages/reports/sales/SalesExceptionsReport'))
const SalesSummaryReport = lazy(() => import('./pages/reports/sales/SalesSummaryReport'))
const CustomerDashboard = lazy(() => import('./pages/customers/CustomerDashboard'))
const OrderDashboard = lazy(() => import('./pages/orders/OrderDashboard'))
const AgentDashboard = lazy(() => import('./pages/agent/AgentDashboard'))
const SalesDashboard = lazy(() => import('./pages/sales/SalesDashboard'))
const BrandActivationsPage = lazy(() => import('./pages/brand-activations/BrandActivationsPage'))
const TenantManagement = lazy(() => import('./pages/superadmin/TenantManagement'))
const FieldAgentDashboardPage = lazy(() => import('./pages/field-operations/FieldAgentDashboardPage'))
const LiveGPSTrackingPage = lazy(() => import('./pages/field-operations/LiveGPSTrackingPage'))
const VisitHistoryPage = lazy(() => import('./pages/field-operations/VisitHistoryPage'))
const VanCashCollectionPage = lazy(() => import('./pages/van-sales/VanCashCollectionPage'))
const VanInventoryPage = lazy(() => import('./pages/van-sales/VanInventoryPage'))
const VanOrdersListPage = lazy(() => import('./pages/van-sales/VanOrdersListPage'))
const VanPerformancePage = lazy(() => import('./pages/van-sales/VanPerformancePage'))
const VanRoutesListPage = lazy(() => import('./pages/van-sales/VanRoutesListPage'))
const ExecutiveInsightsDashboard = lazy(() => import('./pages/insights/ExecutiveDashboard'))
const SalesInsights = lazy(() => import('./pages/insights/SalesInsights'))
const VanSalesInsights = lazy(() => import('./pages/insights/VanSalesInsights'))
const FieldOpsInsights = lazy(() => import('./pages/insights/FieldOpsInsights'))
const TradePromoInsights = lazy(() => import('./pages/insights/TradePromoInsights'))
const StockInsights = lazy(() => import('./pages/insights/StockInsights'))
const CommissionInsights = lazy(() => import('./pages/insights/CommissionInsights'))
const GoalsInsights = lazy(() => import('./pages/insights/GoalsInsights'))
const AnomalyInsights = lazy(() => import('./pages/insights/AnomalyInsights'))
const QuickVisitPage = lazy(() => import('./pages/visits/QuickVisitPage'))
const PlanMyDayPage = lazy(() => import('./pages/visits/PlanMyDayPage'))
const OnboardingPage = lazy(() => import('./pages/onboarding/OnboardingPage'))

const OrdersKanban = lazy(() => import('./pages/OrdersKanban'))
const SKUAvailabilityCheckerPage = lazy(() => import('./pages/SKUAvailabilityCheckerPage'))
const POSMaterialTrackerPage = lazy(() => import('./pages/POSMaterialTrackerPage'))
const VisitWorkflowPage = lazy(() => import('./pages/VisitWorkflowPage'))
const FieldMarketingAgentPage = lazy(() => import('./pages/FieldMarketingAgentPage'))
const TradeMarketingAgentPage = lazy(() => import('./pages/TradeMarketingAgentPage'))
const CustomerSelectionPage = lazy(() => import('./pages/CustomerSelectionPage'))
const BrandActivationFormPage = lazy(() => import('./pages/BrandActivationFormPage'))
const ShelfAnalyticsFormPage = lazy(() => import('./pages/ShelfAnalyticsFormPage'))
const CustomersAdvanced = lazy(() => import('./pages/CustomersAdvanced'))
const MobileLoginPage = lazy(() => import('./pages/auth/MobileLoginPage'))
const RoleManagementPage = lazy(() => import('./pages/admin-settings/RoleManagementPage'))
const CalculationDetail = lazy(() => import('./pages/commissions/calculation-details/CalculationDetail'))
const CalculationLog = lazy(() => import('./pages/commissions/calculation-details/CalculationLog'))
const ApprovalDetail = lazy(() => import('./pages/commissions/calculation-details/ApprovalDetail'))
const ExceptionDetail = lazy(() => import('./pages/commissions/calculation-details/ExceptionDetail'))
const RuleConditionDetail = lazy(() => import('./pages/commissions/calculation-details/RuleConditionDetail'))
const PayoutLineList = lazy(() => import('./pages/commissions/payout-lines/PayoutLineList'))
const PayoutLineDetail = lazy(() => import('./pages/commissions/payout-lines/PayoutLineDetail'))
const PayoutLineEdit = lazy(() => import('./pages/commissions/payout-lines/PayoutLineEdit'))
const PayoutAuditTrail = lazy(() => import('./pages/commissions/payout-lines/PayoutAuditTrail'))
const SourceTransactions = lazy(() => import('./pages/commissions/payout-lines/SourceTransactions'))
const BoardPlacementHistory = lazy(() => import('./pages/field-operations/board-management/BoardPlacementHistory'))
const BoardPhotoHistory = lazy(() => import('./pages/field-operations/board-management/BoardPhotoHistory'))
const BoardLocationChanges = lazy(() => import('./pages/field-operations/board-management/BoardLocationChanges'))
const BoardMaintenanceLog = lazy(() => import('./pages/field-operations/board-management/BoardMaintenanceLog'))
const BoardComplianceChecks = lazy(() => import('./pages/field-operations/board-management/BoardComplianceChecks'))
const PhotoGallery = lazy(() => import('./pages/field-operations/photos/PhotoGallery'))
const PhotoEvidence = lazy(() => import('./pages/field-operations/photos/PhotoEvidence'))
const PhotoTimeline = lazy(() => import('./pages/field-operations/photos/PhotoTimeline'))
const PhotoDetail = lazy(() => import('./pages/field-operations/photos/PhotoDetail'))
const SurveyResponseDetail = lazy(() => import('./pages/field-operations/survey-responses/SurveyResponseDetail'))
const SurveyResponseEdit = lazy(() => import('./pages/field-operations/survey-responses/SurveyResponseEdit'))
const SurveyAnalysis = lazy(() => import('./pages/field-operations/survey-responses/SurveyAnalysis'))
const SurveyComparison = lazy(() => import('./pages/field-operations/survey-responses/SurveyComparison'))
const SurveyAnswerDetail = lazy(() => import('./pages/field-operations/survey-responses/SurveyAnswerDetail'))
const VisitTaskList = lazy(() => import('./pages/field-operations/visit-tasks/VisitTaskList'))
const VisitTaskDetail = lazy(() => import('./pages/field-operations/visit-tasks/VisitTaskDetail'))
const VisitTaskEdit = lazy(() => import('./pages/field-operations/visit-tasks/VisitTaskEdit'))
const VisitTaskSurveyDetail = lazy(() => import('./pages/field-operations/visit-tasks/SurveyDetail'))
const InvoiceItemList = lazy(() => import('./pages/finance/invoice-items/InvoiceItemList'))
const InvoiceItemDetail = lazy(() => import('./pages/finance/invoice-items/InvoiceItemDetail'))
const InvoiceItemEdit = lazy(() => import('./pages/finance/invoice-items/InvoiceItemEdit'))
const InvoiceItemHistory = lazy(() => import('./pages/finance/invoice-items/InvoiceItemHistory'))
const PaymentAllocationList = lazy(() => import('./pages/finance/payment-allocations/PaymentAllocationList'))
const PaymentAllocationCreate = lazy(() => import('./pages/finance/payment-allocations/PaymentAllocationCreate'))
const PaymentAllocationDetail = lazy(() => import('./pages/finance/payment-allocations/PaymentAllocationDetail'))
const PaymentAllocationEdit = lazy(() => import('./pages/finance/payment-allocations/PaymentAllocationEdit'))
const InvoiceStatusHistory = lazy(() => import('./pages/finance/invoice-status-history/InvoiceStatusHistory'))
const PaymentStatusHistory = lazy(() => import('./pages/finance/payment-status-history/PaymentStatusHistory'))
const AdjustmentItemList = lazy(() => import('./pages/inventory/adjustment-items/AdjustmentItemList'))
const AdjustmentItemDetail = lazy(() => import('./pages/inventory/adjustment-items/AdjustmentItemDetail'))
const AdjustmentItemEdit = lazy(() => import('./pages/inventory/adjustment-items/AdjustmentItemEdit'))
const AdjustmentJustification = lazy(() => import('./pages/inventory/adjustment-items/AdjustmentJustification'))
const BatchDetail = lazy(() => import('./pages/inventory/batch-tracking/BatchDetail'))
const BatchExpiry = lazy(() => import('./pages/inventory/batch-tracking/BatchExpiry'))
const BatchAllocation = lazy(() => import('./pages/inventory/batch-tracking/BatchAllocation'))
const BatchMovementHistory = lazy(() => import('./pages/inventory/batch-tracking/BatchMovementHistory'))
const LotTracking = lazy(() => import('./pages/inventory/batch-tracking/LotTracking'))
const LotDetail = lazy(() => import('./pages/inventory/batch-tracking/LotDetail'))
const SerialTracking = lazy(() => import('./pages/inventory/batch-tracking/SerialTracking'))
const SerialDetail = lazy(() => import('./pages/inventory/batch-tracking/SerialDetail'))
const CountLineList = lazy(() => import('./pages/inventory/stock-count-lines/CountLineList'))
const CountLineDetail = lazy(() => import('./pages/inventory/stock-count-lines/CountLineDetail'))
const CountLineEdit = lazy(() => import('./pages/inventory/stock-count-lines/CountLineEdit'))
const CountLineApproval = lazy(() => import('./pages/inventory/stock-count-lines/CountLineApproval'))
const VarianceResolution = lazy(() => import('./pages/inventory/stock-count-lines/VarianceResolution'))
const StockLedgerByProduct = lazy(() => import('./pages/inventory/stock-ledger/StockLedgerByProduct'))
const StockLedgerByWarehouse = lazy(() => import('./pages/inventory/stock-ledger/StockLedgerByWarehouse'))
const StockLedgerDetail = lazy(() => import('./pages/inventory/stock-ledger/StockLedgerDetail'))
const MovementDetail = lazy(() => import('./pages/inventory/stock-ledger/MovementDetail'))
const TransferItemList = lazy(() => import('./pages/inventory/transfer-items/TransferItemList'))
const TransferItemDetail = lazy(() => import('./pages/inventory/transfer-items/TransferItemDetail'))
const TransferItemEdit = lazy(() => import('./pages/inventory/transfer-items/TransferItemEdit'))
const TransferItemTracking = lazy(() => import('./pages/inventory/transfer-items/TransferItemTracking'))
const DeliveryList = lazy(() => import('./pages/orders/deliveries/DeliveryList'))
const DeliveryDetail = lazy(() => import('./pages/orders/deliveries/DeliveryDetail'))
const DeliveryEdit = lazy(() => import('./pages/orders/deliveries/DeliveryEdit'))
const DeliveryPOD = lazy(() => import('./pages/orders/deliveries/DeliveryPOD'))
const DeliveryStops = lazy(() => import('./pages/orders/deliveries/DeliveryStops'))
const DeliveryStopDetail = lazy(() => import('./pages/orders/deliveries/DeliveryStopDetail'))
const OrderItemList = lazy(() => import('./pages/orders/items/OrderItemList'))
const OrderItemDetail = lazy(() => import('./pages/orders/items/OrderItemDetail'))
const OrderItemEdit = lazy(() => import('./pages/orders/items/OrderItemEdit'))
const OrderItemHistory = lazy(() => import('./pages/orders/items/OrderItemHistory'))
const ReturnItemList = lazy(() => import('./pages/orders/returns-items/ReturnItemList'))
const ReturnItemDetail = lazy(() => import('./pages/orders/returns-items/ReturnItemDetail'))
const ReturnItemEdit = lazy(() => import('./pages/orders/returns-items/ReturnItemEdit'))
const ReturnItemApproval = lazy(() => import('./pages/orders/returns-items/ReturnItemApproval'))
const OrderStatusHistory = lazy(() => import('./pages/orders/status-history/OrderStatusHistory'))
const StatusTransitionDetail = lazy(() => import('./pages/orders/status-history/StatusTransitionDetail'))
const RouteStopList = lazy(() => import('./pages/van-sales/route-stops/RouteStopList'))
const RouteStopDetail = lazy(() => import('./pages/van-sales/route-stops/RouteStopDetail'))
const RouteStopEdit = lazy(() => import('./pages/van-sales/route-stops/RouteStopEdit'))
const RouteStopExceptions = lazy(() => import('./pages/van-sales/route-stops/RouteStopExceptions'))
const RouteStopPerformance = lazy(() => import('./pages/van-sales/route-stops/RouteStopPerformance'))
const VanLoadItemList = lazy(() => import('./pages/van-sales/van-load-items/VanLoadItemList'))
const VanLoadItemDetail = lazy(() => import('./pages/van-sales/van-load-items/VanLoadItemDetail'))
const VanLoadItemEdit = lazy(() => import('./pages/van-sales/van-load-items/VanLoadItemEdit'))
const VanLoadReconciliation = lazy(() => import('./pages/van-sales/van-load-items/VanLoadReconciliation'))
const VanLoadVariance = lazy(() => import('./pages/van-sales/van-load-items/VanLoadVariance'))
const CashSessionCollectionDetail = lazy(() => import('./pages/van-sales/cash-session-lines/CollectionDetail'))
const CashSessionDepositDetail = lazy(() => import('./pages/van-sales/cash-session-lines/DepositDetail'))
const CashVariance = lazy(() => import('./pages/van-sales/cash-session-lines/CashVariance'))

// Page loading fallback
const PageSkeleton = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-[#00E87B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  </div>
)

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
      <div className="min-h-screen bg-[#06090F]">
        <Routes>
          {/* Marketing Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Public Routes */}
          <Route path="/auth/*" element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthLayout />
          }>
            <Route path="login" element={<Suspense fallback={<PageSkeleton />}><LoginPage /></Suspense>} />
            <Route path="forgot-password" element={<Suspense fallback={<PageSkeleton />}><ForgotPasswordPage /></Suspense>} />
            <Route path="reset-password" element={<Suspense fallback={<PageSkeleton />}><ResetPasswordPage /></Suspense>} />
            <Route index element={<Navigate to="login" replace />} />
          </Route>

          {/* Protected Routes - using pathless parent to avoid catch-all matching "/" */}
          <Route element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            {/* Dashboard Routes */}
            <Route path="dashboard" element={<Suspense fallback={<PageSkeleton />}><DashboardPage /></Suspense>} />
            <Route path="analytics" element={<Suspense fallback={<PageSkeleton />}><AnalyticsPage /></Suspense>} />
            
            <Route path="analytics-dashboard/*" element={<Navigate to="/insights" replace />} />
            
                        {/* Reports Routes */}
                        <Route path="reports" element={<Suspense fallback={<PageSkeleton />}><ReportsHub /></Suspense>} />
                        <Route path="reports/hub" element={<Suspense fallback={<PageSkeleton />}><ReportsHub /></Suspense>} />
                        <Route path="reports/builder" element={<Suspense fallback={<PageSkeleton />}><ReportBuilderPage /></Suspense>} />
            <Route path="reports/templates" element={<Suspense fallback={<PageSkeleton />}><ReportTemplatesPage /></Suspense>} />
            <Route path="reports/create" element={<Suspense fallback={<PageSkeleton />}><ReportCreate /></Suspense>} />
            <Route path="reports/:id" element={<Suspense fallback={<PageSkeleton />}><ReportDetail /></Suspense>} />
            <Route path="reports/:id/edit" element={<Suspense fallback={<PageSkeleton />}><ReportEdit /></Suspense>} />
            <Route path="reports/sales/summary" element={<Suspense fallback={<PageSkeleton />}><SalesSummaryReport /></Suspense>} />
            <Route path="reports/sales/exceptions" element={<Suspense fallback={<PageSkeleton />}><SalesExceptionsReport /></Suspense>} />
            <Route path="reports/finance/commission-summary" element={<Suspense fallback={<PageSkeleton />}><CommissionSummaryReport /></Suspense>} />
            <Route path="reports/inventory/snapshot" element={<Suspense fallback={<PageSkeleton />}><InventorySnapshotReport /></Suspense>} />
            <Route path="reports/inventory/variance" element={<Suspense fallback={<PageSkeleton />}><VarianceAnalysisReport /></Suspense>} />
            <Route path="reports/operations/field-ops-productivity" element={<Suspense fallback={<PageSkeleton />}><FieldOperationsProductivityReport /></Suspense>} />
            
            <Route path="reports-analytics/*" element={<Navigate to="/reports" replace />} />

            {/* Van Sales Routes */}
            <Route path="van-sales" element={<Suspense fallback={<PageSkeleton />}><VanSalesDashboard /></Suspense>} />
            <Route path="van-sales/dashboard" element={<Suspense fallback={<PageSkeleton />}><VanSalesDashboard /></Suspense>} />
            <Route path="van-sales/workflow" element={<Suspense fallback={<PageSkeleton />}><VanSalesWorkflowPageMobile /></Suspense>} />
            <Route path="van-sales/management" element={<Suspense fallback={<PageSkeleton />}><VanSalesPage /></Suspense>} />
            <Route path="van-sales/performance" element={<Suspense fallback={<PageSkeleton />}><VanPerformancePage /></Suspense>} />
            <Route path="van-sales/cash-collection" element={<Suspense fallback={<PageSkeleton />}><VanCashCollectionPage /></Suspense>} />
            <Route path="van-sales/van-inventory" element={<Suspense fallback={<PageSkeleton />}><VanInventoryPage /></Suspense>} />
            <Route path="van-sales/routes" element={<Suspense fallback={<PageSkeleton />}><VanRoutesListPage /></Suspense>} />
            <Route path="van-sales/routes/create" element={<Suspense fallback={<PageSkeleton />}><RouteCreate /></Suspense>} />
            <Route path="van-sales/routes/:id" element={<Suspense fallback={<PageSkeleton />}><RouteDetail /></Suspense>} />
            <Route path="van-sales/routes/:id/edit" element={<Suspense fallback={<PageSkeleton />}><RouteEdit /></Suspense>} />
            <Route path="van-sales/routes/:id/customers" element={<Suspense fallback={<PageSkeleton />}><RouteCustomers /></Suspense>} />
            <Route path="van-sales/routes/:id/orders" element={<Suspense fallback={<PageSkeleton />}><RouteOrders /></Suspense>} />
            <Route path="van-sales/routes/:id/performance" element={<Suspense fallback={<PageSkeleton />}><RoutePerformance /></Suspense>} />
            <Route path="van-sales/inventory" element={<Suspense fallback={<PageSkeleton />}><InventoryTrackingPage /></Suspense>} />
            <Route path="van-sales/orders" element={<Suspense fallback={<PageSkeleton />}><VanSalesOrdersList /></Suspense>} />
            <Route path="van-sales/orders/create" element={<Suspense fallback={<PageSkeleton />}><VanOrderCreatePage /></Suspense>} />
            <Route path="van-sales/orders/new" element={<Suspense fallback={<PageSkeleton />}><VanSalesOrderCreate /></Suspense>} />
            <Route path="van-sales/orders/:id" element={<Suspense fallback={<PageSkeleton />}><VanSalesOrderDetail /></Suspense>} />
            <Route path="van-sales/orders/:id/edit" element={<Suspense fallback={<PageSkeleton />}><VanSalesOrderEdit /></Suspense>} />
            <Route path="van-sales/returns" element={<Suspense fallback={<PageSkeleton />}><VanSalesReturnsList /></Suspense>} />
            <Route path="van-sales/returns/create" element={<Suspense fallback={<PageSkeleton />}><VanSalesReturnCreate /></Suspense>} />
            <Route path="van-sales/returns/:id" element={<Suspense fallback={<PageSkeleton />}><VanSalesReturnDetail /></Suspense>} />
            <Route path="van-sales/van-loads" element={<Suspense fallback={<PageSkeleton />}><VanLoadsList /></Suspense>} />
            <Route path="van-sales/van-loads/create" element={<Suspense fallback={<PageSkeleton />}><VanLoadCreate /></Suspense>} />
            <Route path="van-sales/van-loads/:id" element={<Suspense fallback={<PageSkeleton />}><VanLoadDetail /></Suspense>} />
            <Route path="van-sales/cash-reconciliation" element={<Suspense fallback={<PageSkeleton />}><VanCashReconciliationList /></Suspense>} />
            <Route path="van-sales/cash-reconciliation/create" element={<Suspense fallback={<PageSkeleton />}><VanCashReconciliationCreate /></Suspense>} />
            <Route path="van-sales/cash-reconciliation/:id" element={<Suspense fallback={<PageSkeleton />}><VanCashReconciliationDetail /></Suspense>} />

            {/* Field Operations Routes */}
            <Route path="field-operations" element={<Suspense fallback={<PageSkeleton />}><FieldOperationsDashboard /></Suspense>} />
            <Route path="field-operations/dashboard" element={<Suspense fallback={<PageSkeleton />}><FieldOperationsDashboard /></Suspense>} />
            <Route path="field-operations/agent-dashboard" element={<Suspense fallback={<PageSkeleton />}><FieldAgentDashboardPage /></Suspense>} />
            <Route path="field-operations/agents" element={<Suspense fallback={<PageSkeleton />}><FieldAgentDashboardPage /></Suspense>} />
            <Route path="field-operations/mapping" element={<Suspense fallback={<PageSkeleton />}><LiveGPSTrackingPage /></Suspense>} />
            <Route path="field-operations/gps-tracking" element={<Suspense fallback={<PageSkeleton />}><LiveGPSTrackingPage /></Suspense>} />
            <Route path="field-operations/boards" element={<Suspense fallback={<PageSkeleton />}><BoardPlacementsList /></Suspense>} />
            <Route path="field-operations/boards/create" element={<Suspense fallback={<PageSkeleton />}><BoardPlacementFormPage /></Suspense>} />
            <Route path="field-operations/boards/:id" element={<Suspense fallback={<PageSkeleton />}><BoardPlacementDetail /></Suspense>} />
            <Route path="field-operations/products" element={<Suspense fallback={<PageSkeleton />}><ProductDistributionsList /></Suspense>} />
            <Route path="field-operations/products/create" element={<Suspense fallback={<PageSkeleton />}><ProductDistributionFormPage /></Suspense>} />
            <Route path="field-operations/products/:id" element={<Suspense fallback={<PageSkeleton />}><ProductDistributionDetail /></Suspense>} />
            <Route path="field-operations/commission" element={<Suspense fallback={<PageSkeleton />}><CommissionLedgerList /></Suspense>} />
            <Route path="field-operations/commission/:id" element={<Suspense fallback={<PageSkeleton />}><CommissionLedgerDetail /></Suspense>} />
            <Route path="field-operations/visits" element={<Suspense fallback={<PageSkeleton />}><VisitManagementPage /></Suspense>} />
            <Route path="field-operations/visits/create" element={<Suspense fallback={<PageSkeleton />}><VisitCreate /></Suspense>} />
            <Route path="field-operations/visits/:id" element={<Suspense fallback={<PageSkeleton />}><VisitDetail /></Suspense>} />
            <Route path="field-operations/visits/:id/edit" element={<Suspense fallback={<PageSkeleton />}><VisitEdit /></Suspense>} />
            <Route path="field-operations/visit-configurations" element={<Suspense fallback={<PageSkeleton />}><VisitConfigurationPage /></Suspense>} />
            <Route path="field-operations/visit-history" element={<Suspense fallback={<PageSkeleton />}><VisitHistoryPage /></Suspense>} />
            <Route path="field-operations/visit-management" element={<Suspense fallback={<PageSkeleton />}><VisitManagementPage /></Suspense>} />

            <Route path="field-operations/quick-visit" element={<Suspense fallback={<PageSkeleton />}><QuickVisitPage /></Suspense>} />
            <Route path="field-operations/plan-my-day" element={<Suspense fallback={<PageSkeleton />}><PlanMyDayPage /></Suspense>} />

            <Route path="field-marketing/*" element={<Navigate to="/field-operations" replace />} />

            {/* Onboarding */}
            <Route path="onboarding" element={<Suspense fallback={<PageSkeleton />}><OnboardingPage /></Suspense>} />

            {/* KYC Routes */}
            <Route path="kyc" element={<Suspense fallback={<PageSkeleton />}><KYCDashboard /></Suspense>} />
            <Route path="kyc/dashboard" element={<Suspense fallback={<PageSkeleton />}><KYCDashboard /></Suspense>} />
            <Route path="kyc/management" element={<Suspense fallback={<PageSkeleton />}><KYCManagement /></Suspense>} />
            <Route path="kyc/create" element={<Suspense fallback={<PageSkeleton />}><KYCCreate /></Suspense>} />
            <Route path="kyc/:id" element={<Suspense fallback={<PageSkeleton />}><KYCDetail /></Suspense>} />
            <Route path="kyc/:id/edit" element={<Suspense fallback={<PageSkeleton />}><KYCEdit /></Suspense>} />
            <Route path="kyc/reports" element={<Suspense fallback={<PageSkeleton />}><KYCReports /></Suspense>} />
            
            <Route path="kyc-surveys/*" element={<Navigate to="/kyc" replace />} />

            {/* Surveys Routes */}
            <Route path="surveys" element={<Suspense fallback={<PageSkeleton />}><SurveysDashboard /></Suspense>} />
            <Route path="surveys/dashboard" element={<Suspense fallback={<PageSkeleton />}><SurveysDashboard /></Suspense>} />
            <Route path="surveys/management" element={<Suspense fallback={<PageSkeleton />}><SurveysManagement /></Suspense>} />
            <Route path="surveys/create" element={<Suspense fallback={<PageSkeleton />}><SurveyCreate /></Suspense>} />
            <Route path="surveys/:id/edit" element={<Suspense fallback={<PageSkeleton />}><SurveyEdit /></Suspense>} />
            <Route path="surveys/:id/responses" element={<Suspense fallback={<PageSkeleton />}><SurveyResponses /></Suspense>} />
            <Route path="surveys/:id/analytics" element={<Suspense fallback={<PageSkeleton />}><SurveyAnalytics /></Suspense>} />

            {/* Inventory Routes */}
            <Route path="inventory" element={<Suspense fallback={<PageSkeleton />}><InventoryDashboard /></Suspense>} />
            <Route path="inventory/dashboard" element={<Suspense fallback={<PageSkeleton />}><InventoryDashboard /></Suspense>} />
            <Route path="inventory/stock-count" element={<Suspense fallback={<PageSkeleton />}><StockCountWorkflowPage /></Suspense>} />
            <Route path="inventory/stock-count/:id" element={<Suspense fallback={<PageSkeleton />}><StockCountDetail /></Suspense>} />
            <Route path="inventory/management" element={<Suspense fallback={<PageSkeleton />}><InventoryManagement /></Suspense>} />
            <Route path="inventory/reports" element={<Suspense fallback={<PageSkeleton />}><InventoryReports /></Suspense>} />
            <Route path="inventory/adjustments" element={<Suspense fallback={<PageSkeleton />}><AdjustmentsList /></Suspense>} />
            <Route path="inventory/adjustments/create" element={<Suspense fallback={<PageSkeleton />}><AdjustmentCreate /></Suspense>} />
            <Route path="inventory/adjustments/:id" element={<Suspense fallback={<PageSkeleton />}><AdjustmentDetail /></Suspense>} />
            <Route path="inventory/issues" element={<Suspense fallback={<PageSkeleton />}><IssuesList /></Suspense>} />
            <Route path="inventory/issues/create" element={<Suspense fallback={<PageSkeleton />}><IssueCreate /></Suspense>} />
            <Route path="inventory/issues/:id" element={<Suspense fallback={<PageSkeleton />}><IssueDetail /></Suspense>} />
            <Route path="inventory/receipts" element={<Suspense fallback={<PageSkeleton />}><ReceiptsList /></Suspense>} />
            <Route path="inventory/receipts/create" element={<Suspense fallback={<PageSkeleton />}><ReceiptCreate /></Suspense>} />
            <Route path="inventory/receipts/:id" element={<Suspense fallback={<PageSkeleton />}><ReceiptDetail /></Suspense>} />
            <Route path="inventory/stock-counts" element={<Suspense fallback={<PageSkeleton />}><StockCountsList /></Suspense>} />
            <Route path="inventory/stock-counts/create" element={<Suspense fallback={<PageSkeleton />}><StockCountCreate /></Suspense>} />
            <Route path="inventory/stock-counts/:id" element={<Suspense fallback={<PageSkeleton />}><StockCountDetail /></Suspense>} />
            <Route path="inventory/transfers" element={<Suspense fallback={<PageSkeleton />}><TransfersList /></Suspense>} />
            <Route path="inventory/transfers/create" element={<Suspense fallback={<PageSkeleton />}><TransferCreate /></Suspense>} />
            <Route path="inventory/transfers/:id" element={<Suspense fallback={<PageSkeleton />}><TransferDetail /></Suspense>} />
            
            <Route path="inventory-management/*" element={<Navigate to="/inventory" replace />} />

            {/* Promotions Routes */}
            <Route path="promotions" element={<Suspense fallback={<PageSkeleton />}><PromotionsDashboard /></Suspense>} />
            <Route path="promotions/dashboard" element={<Suspense fallback={<PageSkeleton />}><PromotionsDashboard /></Suspense>} />
            <Route path="promotions/management" element={<Suspense fallback={<PageSkeleton />}><PromotionsManagement /></Suspense>} />

            {/* Trade Marketing Routes */}
            <Route path="trade-marketing" element={<Suspense fallback={<PageSkeleton />}><TradeMarketingPage /></Suspense>} />
            <Route path="trade-marketing/activation" element={<Suspense fallback={<PageSkeleton />}><ActivationWorkflowPage /></Suspense>} />
            <Route path="trade-marketing/campaigns" element={<Suspense fallback={<PageSkeleton />}><CampaignManagementPage /></Suspense>} />
            <Route path="trade-marketing/merchandising" element={<Suspense fallback={<PageSkeleton />}><MerchandisingCompliancePage /></Suspense>} />
            <Route path="trade-marketing/promoters" element={<Suspense fallback={<PageSkeleton />}><PromoterManagementPage /></Suspense>} />
            <Route path="trade-marketing/analytics" element={<Suspense fallback={<PageSkeleton />}><TradeMarketingAnalyticsPage /></Suspense>} />

            {/* Events Routes */}
            <Route path="events" element={<Suspense fallback={<PageSkeleton />}><EventsPage /></Suspense>} />

            {/* Campaign Routes */}
            <Route path="campaigns" element={<Suspense fallback={<PageSkeleton />}><CampaignsPage /></Suspense>} />
            
            {/* Brand Activations Routes */}
            <Route path="brand-activations" element={<Suspense fallback={<PageSkeleton />}><BrandActivationsPage /></Suspense>} />
            
            {/* Superadmin Routes */}
            <Route path="superadmin/tenants" element={<Suspense fallback={<PageSkeleton />}><TenantManagement /></Suspense>} />

            <Route path="field-agents/*" element={<Navigate to="/field-operations" replace />} />

            {/* Business Routes */}
            <Route path="customers" element={<Suspense fallback={<PageSkeleton />}><CustomersPage /></Suspense>} />
            <Route path="customers/dashboard" element={<Suspense fallback={<PageSkeleton />}><CustomerDashboard /></Suspense>} />
            <Route path="customers/create" element={<Suspense fallback={<PageSkeleton />}><CustomerCreatePage /></Suspense>} />
            <Route path="customers/:id" element={<Suspense fallback={<PageSkeleton />}><CustomerDetailsPage /></Suspense>} />
            <Route path="customers/:id/edit" element={<Suspense fallback={<PageSkeleton />}><CustomerEditPage /></Suspense>} />
            <Route path="customers/:id/orders" element={<Suspense fallback={<PageSkeleton />}><CustomerOrders /></Suspense>} />
            <Route path="customers/:id/visits" element={<Suspense fallback={<PageSkeleton />}><CustomerVisits /></Suspense>} />
            <Route path="customers/:id/payments" element={<Suspense fallback={<PageSkeleton />}><CustomerPayments /></Suspense>} />
            <Route path="customers/:id/surveys" element={<Suspense fallback={<PageSkeleton />}><CustomerSurveys /></Suspense>} />
            <Route path="customers/:id/kyc" element={<Suspense fallback={<PageSkeleton />}><CustomerKYC /></Suspense>} />
            <Route path="orders" element={<Suspense fallback={<PageSkeleton />}><OrdersPage /></Suspense>} />
            <Route path="orders/dashboard" element={<Suspense fallback={<PageSkeleton />}><OrderDashboard /></Suspense>} />
            <Route path="orders/create" element={<Suspense fallback={<PageSkeleton />}><OrderCreatePage /></Suspense>} />
            <Route path="orders/:id" element={<Suspense fallback={<PageSkeleton />}><OrderDetailsPage /></Suspense>} />
            <Route path="orders/:id/edit" element={<Suspense fallback={<PageSkeleton />}><OrderEditPage /></Suspense>} />
            <Route path="orders/:id/items" element={<Suspense fallback={<PageSkeleton />}><OrderItems /></Suspense>} />
            <Route path="orders/:id/payments" element={<Suspense fallback={<PageSkeleton />}><OrderPayments /></Suspense>} />
            <Route path="orders/:id/delivery" element={<Suspense fallback={<PageSkeleton />}><OrderDelivery /></Suspense>} />
            <Route path="orders/:id/returns" element={<Suspense fallback={<PageSkeleton />}><OrderReturns /></Suspense>} />
            <Route path="products" element={<Suspense fallback={<PageSkeleton />}><ProductsPage /></Suspense>} />
            <Route path="products/create" element={<Suspense fallback={<PageSkeleton />}><ProductCreatePage /></Suspense>} />
            <Route path="products/:id" element={<Suspense fallback={<PageSkeleton />}><ProductDetailsPage /></Suspense>} />
            <Route path="products/:id/edit" element={<Suspense fallback={<PageSkeleton />}><ProductEditPage /></Suspense>} />
            <Route path="products/:id/inventory" element={<Suspense fallback={<PageSkeleton />}><ProductInventory /></Suspense>} />
            <Route path="products/:id/pricing" element={<Suspense fallback={<PageSkeleton />}><ProductPricing /></Suspense>} />
            <Route path="products/:id/promotions" element={<Suspense fallback={<PageSkeleton />}><ProductPromotions /></Suspense>} />
            <Route path="products/:id/sales" element={<Suspense fallback={<PageSkeleton />}><ProductSales /></Suspense>} />
            <Route path="brands" element={<Suspense fallback={<PageSkeleton />}><BrandsList /></Suspense>} />
            <Route path="brands/create" element={<Suspense fallback={<PageSkeleton />}><BrandCreate /></Suspense>} />
            <Route path="brands/:id" element={<Suspense fallback={<PageSkeleton />}><BrandDetail /></Suspense>} />
            <Route path="brands/:id/edit" element={<Suspense fallback={<PageSkeleton />}><BrandEdit /></Suspense>} />
            <Route path="brands/:id/surveys" element={<Suspense fallback={<PageSkeleton />}><BrandSurveys /></Suspense>} />
            <Route path="brands/:id/activations" element={<Suspense fallback={<PageSkeleton />}><BrandActivations /></Suspense>} />
            <Route path="brands/:id/boards" element={<Suspense fallback={<PageSkeleton />}><BrandBoards /></Suspense>} />
            <Route path="brands/:id/products" element={<Suspense fallback={<PageSkeleton />}><BrandProducts /></Suspense>} />
            
            <Route path="customer-management/*" element={<Navigate to="/customers" replace />} />
            
            {/* Product Management Routes */}
            <Route path="product-management/list" element={<Suspense fallback={<PageSkeleton />}><ProductListPage /></Suspense>} />
            <Route path="product-management/analytics" element={<Suspense fallback={<PageSkeleton />}><ProductAnalyticsPage /></Suspense>} />
            <Route path="product-management/hierarchy" element={<Suspense fallback={<PageSkeleton />}><ProductHierarchyPage /></Suspense>} />
            <Route path="product-management/import-export" element={<Suspense fallback={<PageSkeleton />}><ProductImportExportPage /></Suspense>} />
            <Route path="product-management/inventory" element={<Suspense fallback={<PageSkeleton />}><ProductInventoryPage /></Suspense>} />
            <Route path="product-management/pricing" element={<Suspense fallback={<PageSkeleton />}><ProductPricingPage /></Suspense>} />
            
            <Route path="order-lifecycle/*" element={<Navigate to="/sales" replace />} />

            {/* Sales Routes */}
            <Route path="sales" element={<Suspense fallback={<PageSkeleton />}><SalesDashboard /></Suspense>} />
            <Route path="sales/orders" element={<Suspense fallback={<PageSkeleton />}><SalesOrdersList /></Suspense>} />
            <Route path="sales/orders/create" element={<Suspense fallback={<PageSkeleton />}><SalesOrderCreate /></Suspense>} />
            <Route path="sales/orders/:id" element={<Suspense fallback={<PageSkeleton />}><SalesOrderDetail /></Suspense>} />
            <Route path="sales/orders/:id/edit" element={<Suspense fallback={<PageSkeleton />}><SalesOrderEdit /></Suspense>} />
            <Route path="sales/invoices" element={<Suspense fallback={<PageSkeleton />}><InvoicesList /></Suspense>} />
            <Route path="sales/invoices/create" element={<Suspense fallback={<PageSkeleton />}><InvoiceCreate /></Suspense>} />
            <Route path="sales/invoices/:id" element={<Suspense fallback={<PageSkeleton />}><InvoiceDetail /></Suspense>} />
            <Route path="sales/payments" element={<Suspense fallback={<PageSkeleton />}><PaymentsList /></Suspense>} />
            <Route path="sales/payments/create" element={<Suspense fallback={<PageSkeleton />}><PaymentCreate /></Suspense>} />
            <Route path="sales/payments/:id" element={<Suspense fallback={<PageSkeleton />}><PaymentDetail /></Suspense>} />
            <Route path="sales/credit-notes" element={<Suspense fallback={<PageSkeleton />}><CreditNotesList /></Suspense>} />
            <Route path="sales/credit-notes/create" element={<Suspense fallback={<PageSkeleton />}><CreditNoteCreate /></Suspense>} />
            <Route path="sales/credit-notes/:id" element={<Suspense fallback={<PageSkeleton />}><CreditNoteDetail /></Suspense>} />
            <Route path="sales/returns" element={<Suspense fallback={<PageSkeleton />}><SalesReturnsList /></Suspense>} />
            <Route path="sales/returns/create" element={<Suspense fallback={<PageSkeleton />}><SalesReturnCreate /></Suspense>} />
            <Route path="sales/returns/:id" element={<Suspense fallback={<PageSkeleton />}><SalesReturnDetail /></Suspense>} />

            {/* Marketing Routes */}
            <Route path="marketing/campaigns" element={<Suspense fallback={<PageSkeleton />}><CampaignsList /></Suspense>} />
            <Route path="marketing/campaigns/create" element={<Suspense fallback={<PageSkeleton />}><CampaignCreate /></Suspense>} />
            <Route path="marketing/campaigns/:id" element={<Suspense fallback={<PageSkeleton />}><CampaignDetail /></Suspense>} />
            <Route path="marketing/campaigns/:id/edit" element={<Suspense fallback={<PageSkeleton />}><CampaignEdit /></Suspense>} />
            <Route path="marketing/events" element={<Suspense fallback={<PageSkeleton />}><EventsList /></Suspense>} />
            <Route path="marketing/events/create" element={<Suspense fallback={<PageSkeleton />}><EventCreate /></Suspense>} />
            <Route path="marketing/events/:id" element={<Suspense fallback={<PageSkeleton />}><EventDetail /></Suspense>} />
            <Route path="marketing/events/:id/edit" element={<Suspense fallback={<PageSkeleton />}><EventEdit /></Suspense>} />
            <Route path="marketing/activations" element={<Suspense fallback={<PageSkeleton />}><ActivationsList /></Suspense>} />
            <Route path="marketing/activations/create" element={<Suspense fallback={<PageSkeleton />}><ActivationCreate /></Suspense>} />
            <Route path="marketing/activations/:id" element={<Suspense fallback={<PageSkeleton />}><ActivationDetail /></Suspense>} />
            <Route path="marketing/promotions" element={<Suspense fallback={<PageSkeleton />}><PromotionsList /></Suspense>} />
            <Route path="marketing/promotions/create" element={<Suspense fallback={<PageSkeleton />}><PromotionCreate /></Suspense>} />
            <Route path="marketing/promotions/:id" element={<Suspense fallback={<PageSkeleton />}><PromotionDetail /></Suspense>} />

            <Route path="crm/*" element={<Navigate to="/customers" replace />} />

            {/* Finance Routes */}
            <Route path="finance" element={<Suspense fallback={<PageSkeleton />}><FinanceDashboard /></Suspense>} />
            <Route path="finance/invoices" element={<Suspense fallback={<PageSkeleton />}><InvoiceManagementPage /></Suspense>} />
            <Route path="finance/invoices/create" element={<Suspense fallback={<PageSkeleton />}><FinanceInvoiceCreate /></Suspense>} />
            <Route path="finance/invoices/:id" element={<Suspense fallback={<PageSkeleton />}><FinanceInvoiceDetail /></Suspense>} />
            <Route path="finance/invoices/:id/edit" element={<Suspense fallback={<PageSkeleton />}><FinanceInvoiceEdit /></Suspense>} />
            <Route path="finance/invoices/:id/payments" element={<Suspense fallback={<PageSkeleton />}><InvoicePayments /></Suspense>} />
            <Route path="finance/invoices/:id/items" element={<Suspense fallback={<PageSkeleton />}><InvoiceItems /></Suspense>} />
            <Route path="finance/payments" element={<Suspense fallback={<PageSkeleton />}><PaymentCollectionPage /></Suspense>} />
            <Route path="finance/payments/create" element={<Suspense fallback={<PageSkeleton />}><FinancePaymentCreate /></Suspense>} />
            <Route path="finance/payments/:id" element={<Suspense fallback={<PageSkeleton />}><FinancePaymentDetail /></Suspense>} />
            <Route path="finance/payments/:id/edit" element={<Suspense fallback={<PageSkeleton />}><FinancePaymentEdit /></Suspense>} />
            <Route path="finance/cash-reconciliation" element={<Suspense fallback={<PageSkeleton />}><CashReconciliationList /></Suspense>} />
            <Route path="finance/cash-reconciliation/create" element={<Suspense fallback={<PageSkeleton />}><CashReconciliationCreate /></Suspense>} />
            <Route path="finance/cash-reconciliation/:id" element={<Suspense fallback={<PageSkeleton />}><CashReconciliationDetail /></Suspense>} />
            <Route path="finance/commission-payouts" element={<Suspense fallback={<PageSkeleton />}><CommissionPayoutsList /></Suspense>} />
            <Route path="finance/commission-payouts/:id" element={<Suspense fallback={<PageSkeleton />}><CommissionPayoutDetail /></Suspense>} />
            
            <Route path="cash-reconciliation/*" element={<Navigate to="/finance/cash-reconciliation" replace />} />
            
            {/* Commission Routes */}
            <Route path="commissions" element={<Suspense fallback={<PageSkeleton />}><CommissionDashboardPage /></Suspense>} />
            <Route path="commissions/create" element={<Suspense fallback={<PageSkeleton />}><CommissionCreate /></Suspense>} />
            <Route path="commissions/:id" element={<Suspense fallback={<PageSkeleton />}><CommissionDetail /></Suspense>} />
            <Route path="commissions/:id/edit" element={<Suspense fallback={<PageSkeleton />}><CommissionEdit /></Suspense>} />
            <Route path="commissions/calculation" element={<Suspense fallback={<PageSkeleton />}><CommissionCalculationPage /></Suspense>} />
            <Route path="commissions/approval" element={<Suspense fallback={<PageSkeleton />}><CommissionApprovalPage /></Suspense>} />
            <Route path="commissions/payment" element={<Suspense fallback={<PageSkeleton />}><CommissionPaymentPage /></Suspense>} />
            <Route path="commissions/reports" element={<Suspense fallback={<PageSkeleton />}><CommissionReportsPage /></Suspense>} />
            <Route path="commissions/settings" element={<Suspense fallback={<PageSkeleton />}><CommissionSettingsPage /></Suspense>} />
            <Route path="commissions/rules/create" element={<Suspense fallback={<PageSkeleton />}><RuleCreate /></Suspense>} />
            <Route path="commissions/rules/:id" element={<Suspense fallback={<PageSkeleton />}><RuleDetail /></Suspense>} />
            <Route path="commissions/rules/:id/edit" element={<Suspense fallback={<PageSkeleton />}><RuleEdit /></Suspense>} />

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
            <Route path="insights" element={<Suspense fallback={<PageSkeleton />}><ExecutiveInsightsDashboard /></Suspense>} />
            <Route path="insights/executive" element={<Suspense fallback={<PageSkeleton />}><ExecutiveInsightsDashboard /></Suspense>} />
            <Route path="insights/sales" element={<Suspense fallback={<PageSkeleton />}><SalesInsights /></Suspense>} />
            <Route path="insights/van-sales" element={<Suspense fallback={<PageSkeleton />}><VanSalesInsights /></Suspense>} />
            <Route path="insights/field-ops" element={<Suspense fallback={<PageSkeleton />}><FieldOpsInsights /></Suspense>} />
            <Route path="insights/trade-promotions" element={<Suspense fallback={<PageSkeleton />}><TradePromoInsights /></Suspense>} />
            <Route path="insights/stock" element={<Suspense fallback={<PageSkeleton />}><StockInsights /></Suspense>} />
            <Route path="insights/commissions" element={<Suspense fallback={<PageSkeleton />}><CommissionInsights /></Suspense>} />
            <Route path="insights/goals" element={<Suspense fallback={<PageSkeleton />}><GoalsInsights /></Suspense>} />
            <Route path="insights/anomalies" element={<Suspense fallback={<PageSkeleton />}><AnomalyInsights /></Suspense>} />

            {/* Top-Level Feature Routes */}
            <Route path="orders/kanban" element={<Suspense fallback={<PageSkeleton />}><OrdersKanban /></Suspense>} />
            <Route path="inventory/sku-checker" element={<Suspense fallback={<PageSkeleton />}><SKUAvailabilityCheckerPage /></Suspense>} />
            <Route path="field-operations/pos-tracker" element={<Suspense fallback={<PageSkeleton />}><POSMaterialTrackerPage /></Suspense>} />
            <Route path="field-operations/visit-workflow" element={<Suspense fallback={<PageSkeleton />}><VisitWorkflowPage /></Suspense>} />
            <Route path="field-operations/agent-workflow" element={<Suspense fallback={<PageSkeleton />}><FieldMarketingAgentPage /></Suspense>} />
            <Route path="trade-marketing/agent-view" element={<Suspense fallback={<PageSkeleton />}><TradeMarketingAgentPage /></Suspense>} />
            <Route path="field-operations/customer-select" element={<Suspense fallback={<PageSkeleton />}><CustomerSelectionPage /></Suspense>} />
            <Route path="marketing/activations/form" element={<Suspense fallback={<PageSkeleton />}><BrandActivationFormPage /></Suspense>} />
            <Route path="field-operations/shelf-analytics" element={<Suspense fallback={<PageSkeleton />}><ShelfAnalyticsFormPage /></Suspense>} />
            <Route path="customers/advanced" element={<Suspense fallback={<PageSkeleton />}><CustomersAdvanced /></Suspense>} />
            <Route path="admin/role-management" element={<ProtectedRoute requiredRole="admin"><RoleManagementPage /></ProtectedRoute>} />

            {/* Commission Drill-Down Routes */}
            <Route path="commissions/calculations/:id" element={<Suspense fallback={<PageSkeleton />}><CalculationDetail /></Suspense>} />
            <Route path="commissions/calculations/:id/log" element={<Suspense fallback={<PageSkeleton />}><CalculationLog /></Suspense>} />
            <Route path="commissions/calculations/:id/approval" element={<Suspense fallback={<PageSkeleton />}><ApprovalDetail /></Suspense>} />
            <Route path="commissions/calculations/:id/exceptions" element={<Suspense fallback={<PageSkeleton />}><ExceptionDetail /></Suspense>} />
            <Route path="commissions/calculations/:id/rules" element={<Suspense fallback={<PageSkeleton />}><RuleConditionDetail /></Suspense>} />
            <Route path="commissions/payouts/:id/lines" element={<Suspense fallback={<PageSkeleton />}><PayoutLineList /></Suspense>} />
            <Route path="commissions/payouts/:id/lines/:lineId" element={<Suspense fallback={<PageSkeleton />}><PayoutLineDetail /></Suspense>} />
            <Route path="commissions/payouts/:id/lines/:lineId/edit" element={<Suspense fallback={<PageSkeleton />}><PayoutLineEdit /></Suspense>} />
            <Route path="commissions/payouts/:id/audit" element={<Suspense fallback={<PageSkeleton />}><PayoutAuditTrail /></Suspense>} />
            <Route path="commissions/payouts/:id/transactions" element={<Suspense fallback={<PageSkeleton />}><SourceTransactions /></Suspense>} />

            {/* Field Operations Drill-Down Routes */}
            <Route path="field-operations/boards/:id/history" element={<Suspense fallback={<PageSkeleton />}><BoardPlacementHistory /></Suspense>} />
            <Route path="field-operations/boards/:id/photos" element={<Suspense fallback={<PageSkeleton />}><BoardPhotoHistory /></Suspense>} />
            <Route path="field-operations/boards/:id/locations" element={<Suspense fallback={<PageSkeleton />}><BoardLocationChanges /></Suspense>} />
            <Route path="field-operations/boards/:id/maintenance" element={<Suspense fallback={<PageSkeleton />}><BoardMaintenanceLog /></Suspense>} />
            <Route path="field-operations/boards/:id/compliance" element={<Suspense fallback={<PageSkeleton />}><BoardComplianceChecks /></Suspense>} />
            <Route path="field-operations/visits/:id/photos" element={<Suspense fallback={<PageSkeleton />}><PhotoGallery /></Suspense>} />
            <Route path="field-operations/visits/:id/photos/:photoId" element={<Suspense fallback={<PageSkeleton />}><PhotoDetail /></Suspense>} />
            <Route path="field-operations/photos/evidence" element={<Suspense fallback={<PageSkeleton />}><PhotoEvidence /></Suspense>} />
            <Route path="field-operations/photos/timeline" element={<Suspense fallback={<PageSkeleton />}><PhotoTimeline /></Suspense>} />
            <Route path="field-operations/survey-responses/:id" element={<Suspense fallback={<PageSkeleton />}><SurveyResponseDetail /></Suspense>} />
            <Route path="field-operations/survey-responses/:id/edit" element={<Suspense fallback={<PageSkeleton />}><SurveyResponseEdit /></Suspense>} />
            <Route path="field-operations/survey-responses/:id/analysis" element={<Suspense fallback={<PageSkeleton />}><SurveyAnalysis /></Suspense>} />
            <Route path="field-operations/survey-responses/comparison" element={<Suspense fallback={<PageSkeleton />}><SurveyComparison /></Suspense>} />
            <Route path="field-operations/survey-responses/:id/answers/:answerId" element={<Suspense fallback={<PageSkeleton />}><SurveyAnswerDetail /></Suspense>} />
            <Route path="field-operations/tasks" element={<Suspense fallback={<PageSkeleton />}><VisitTaskList /></Suspense>} />
            <Route path="field-operations/tasks/:id" element={<Suspense fallback={<PageSkeleton />}><VisitTaskDetail /></Suspense>} />
            <Route path="field-operations/tasks/:id/edit" element={<Suspense fallback={<PageSkeleton />}><VisitTaskEdit /></Suspense>} />
            <Route path="field-operations/tasks/:id/survey" element={<Suspense fallback={<PageSkeleton />}><VisitTaskSurveyDetail /></Suspense>} />

            {/* Finance Drill-Down Routes */}
            <Route path="finance/invoices/:id/line-items" element={<Suspense fallback={<PageSkeleton />}><InvoiceItemList /></Suspense>} />
            <Route path="finance/invoices/:id/line-items/:itemId" element={<Suspense fallback={<PageSkeleton />}><InvoiceItemDetail /></Suspense>} />
            <Route path="finance/invoices/:id/line-items/:itemId/edit" element={<Suspense fallback={<PageSkeleton />}><InvoiceItemEdit /></Suspense>} />
            <Route path="finance/invoices/:id/line-items/:itemId/history" element={<Suspense fallback={<PageSkeleton />}><InvoiceItemHistory /></Suspense>} />
            <Route path="finance/invoices/:id/status-history" element={<Suspense fallback={<PageSkeleton />}><InvoiceStatusHistory /></Suspense>} />
            <Route path="finance/payments/:id/allocations" element={<Suspense fallback={<PageSkeleton />}><PaymentAllocationList /></Suspense>} />
            <Route path="finance/payments/:id/allocations/create" element={<Suspense fallback={<PageSkeleton />}><PaymentAllocationCreate /></Suspense>} />
            <Route path="finance/payments/:id/allocations/:allocId" element={<Suspense fallback={<PageSkeleton />}><PaymentAllocationDetail /></Suspense>} />
            <Route path="finance/payments/:id/allocations/:allocId/edit" element={<Suspense fallback={<PageSkeleton />}><PaymentAllocationEdit /></Suspense>} />
            <Route path="finance/payments/:id/status-history" element={<Suspense fallback={<PageSkeleton />}><PaymentStatusHistory /></Suspense>} />

            {/* Inventory Drill-Down Routes */}
            <Route path="inventory/adjustments/:id/items" element={<Suspense fallback={<PageSkeleton />}><AdjustmentItemList /></Suspense>} />
            <Route path="inventory/adjustments/:id/items/:itemId" element={<Suspense fallback={<PageSkeleton />}><AdjustmentItemDetail /></Suspense>} />
            <Route path="inventory/adjustments/:id/items/:itemId/edit" element={<Suspense fallback={<PageSkeleton />}><AdjustmentItemEdit /></Suspense>} />
            <Route path="inventory/adjustments/:id/items/:itemId/justification" element={<Suspense fallback={<PageSkeleton />}><AdjustmentJustification /></Suspense>} />
            <Route path="inventory/batches" element={<Suspense fallback={<PageSkeleton />}><LotTracking /></Suspense>} />
            <Route path="inventory/batches/:id" element={<Suspense fallback={<PageSkeleton />}><BatchDetail /></Suspense>} />
            <Route path="inventory/batches/:id/expiry" element={<Suspense fallback={<PageSkeleton />}><BatchExpiry /></Suspense>} />
            <Route path="inventory/batches/:id/allocation" element={<Suspense fallback={<PageSkeleton />}><BatchAllocation /></Suspense>} />
            <Route path="inventory/batches/:id/movements" element={<Suspense fallback={<PageSkeleton />}><BatchMovementHistory /></Suspense>} />
            <Route path="inventory/lots" element={<Suspense fallback={<PageSkeleton />}><LotTracking /></Suspense>} />
            <Route path="inventory/lots/:id" element={<Suspense fallback={<PageSkeleton />}><LotDetail /></Suspense>} />
            <Route path="inventory/serials" element={<Suspense fallback={<PageSkeleton />}><SerialTracking /></Suspense>} />
            <Route path="inventory/serials/:id" element={<Suspense fallback={<PageSkeleton />}><SerialDetail /></Suspense>} />
            <Route path="inventory/stock-counts/:id/lines" element={<Suspense fallback={<PageSkeleton />}><CountLineList /></Suspense>} />
            <Route path="inventory/stock-counts/:id/lines/:lineId" element={<Suspense fallback={<PageSkeleton />}><CountLineDetail /></Suspense>} />
            <Route path="inventory/stock-counts/:id/lines/:lineId/edit" element={<Suspense fallback={<PageSkeleton />}><CountLineEdit /></Suspense>} />
            <Route path="inventory/stock-counts/:id/lines/:lineId/approve" element={<Suspense fallback={<PageSkeleton />}><CountLineApproval /></Suspense>} />
            <Route path="inventory/stock-counts/:id/lines/:lineId/variance" element={<Suspense fallback={<PageSkeleton />}><VarianceResolution /></Suspense>} />
            <Route path="inventory/ledger/by-product" element={<Suspense fallback={<PageSkeleton />}><StockLedgerByProduct /></Suspense>} />
            <Route path="inventory/ledger/by-warehouse" element={<Suspense fallback={<PageSkeleton />}><StockLedgerByWarehouse /></Suspense>} />
            <Route path="inventory/ledger/:id" element={<Suspense fallback={<PageSkeleton />}><StockLedgerDetail /></Suspense>} />
            <Route path="inventory/ledger/movements/:id" element={<Suspense fallback={<PageSkeleton />}><MovementDetail /></Suspense>} />
            <Route path="inventory/transfers/:id/items" element={<Suspense fallback={<PageSkeleton />}><TransferItemList /></Suspense>} />
            <Route path="inventory/transfers/:id/items/:itemId" element={<Suspense fallback={<PageSkeleton />}><TransferItemDetail /></Suspense>} />
            <Route path="inventory/transfers/:id/items/:itemId/edit" element={<Suspense fallback={<PageSkeleton />}><TransferItemEdit /></Suspense>} />
            <Route path="inventory/transfers/:id/items/:itemId/tracking" element={<Suspense fallback={<PageSkeleton />}><TransferItemTracking /></Suspense>} />

            {/* Order Drill-Down Routes */}
            <Route path="orders/:id/deliveries" element={<Suspense fallback={<PageSkeleton />}><DeliveryList /></Suspense>} />
            <Route path="orders/:id/deliveries/:delId" element={<Suspense fallback={<PageSkeleton />}><DeliveryDetail /></Suspense>} />
            <Route path="orders/:id/deliveries/:delId/edit" element={<Suspense fallback={<PageSkeleton />}><DeliveryEdit /></Suspense>} />
            <Route path="orders/:id/deliveries/:delId/pod" element={<Suspense fallback={<PageSkeleton />}><DeliveryPOD /></Suspense>} />
            <Route path="orders/:id/deliveries/:delId/stops" element={<Suspense fallback={<PageSkeleton />}><DeliveryStops /></Suspense>} />
            <Route path="orders/:id/deliveries/:delId/stops/:stopId" element={<Suspense fallback={<PageSkeleton />}><DeliveryStopDetail /></Suspense>} />
            <Route path="orders/:id/line-items" element={<Suspense fallback={<PageSkeleton />}><OrderItemList /></Suspense>} />
            <Route path="orders/:id/line-items/:itemId" element={<Suspense fallback={<PageSkeleton />}><OrderItemDetail /></Suspense>} />
            <Route path="orders/:id/line-items/:itemId/edit" element={<Suspense fallback={<PageSkeleton />}><OrderItemEdit /></Suspense>} />
            <Route path="orders/:id/line-items/:itemId/history" element={<Suspense fallback={<PageSkeleton />}><OrderItemHistory /></Suspense>} />
            <Route path="orders/:id/returns/:returnId/items" element={<Suspense fallback={<PageSkeleton />}><ReturnItemList /></Suspense>} />
            <Route path="orders/:id/returns/:returnId/items/:itemId" element={<Suspense fallback={<PageSkeleton />}><ReturnItemDetail /></Suspense>} />
            <Route path="orders/:id/returns/:returnId/items/:itemId/edit" element={<Suspense fallback={<PageSkeleton />}><ReturnItemEdit /></Suspense>} />
            <Route path="orders/:id/returns/:returnId/items/:itemId/approve" element={<Suspense fallback={<PageSkeleton />}><ReturnItemApproval /></Suspense>} />
            <Route path="orders/:id/status-history" element={<Suspense fallback={<PageSkeleton />}><OrderStatusHistory /></Suspense>} />
            <Route path="orders/:id/status-history/:transitionId" element={<Suspense fallback={<PageSkeleton />}><StatusTransitionDetail /></Suspense>} />

            {/* Van Sales Drill-Down Routes */}
            <Route path="van-sales/routes/:id/stops" element={<Suspense fallback={<PageSkeleton />}><RouteStopList /></Suspense>} />
            <Route path="van-sales/routes/:id/stops/:stopId" element={<Suspense fallback={<PageSkeleton />}><RouteStopDetail /></Suspense>} />
            <Route path="van-sales/routes/:id/stops/:stopId/edit" element={<Suspense fallback={<PageSkeleton />}><RouteStopEdit /></Suspense>} />
            <Route path="van-sales/routes/:id/stops/:stopId/exceptions" element={<Suspense fallback={<PageSkeleton />}><RouteStopExceptions /></Suspense>} />
            <Route path="van-sales/routes/:id/stops/:stopId/performance" element={<Suspense fallback={<PageSkeleton />}><RouteStopPerformance /></Suspense>} />
            <Route path="van-sales/van-loads/:id/items" element={<Suspense fallback={<PageSkeleton />}><VanLoadItemList /></Suspense>} />
            <Route path="van-sales/van-loads/:id/items/:itemId" element={<Suspense fallback={<PageSkeleton />}><VanLoadItemDetail /></Suspense>} />
            <Route path="van-sales/van-loads/:id/items/:itemId/edit" element={<Suspense fallback={<PageSkeleton />}><VanLoadItemEdit /></Suspense>} />
            <Route path="van-sales/van-loads/:id/reconciliation" element={<Suspense fallback={<PageSkeleton />}><VanLoadReconciliation /></Suspense>} />
            <Route path="van-sales/van-loads/:id/variance" element={<Suspense fallback={<PageSkeleton />}><VanLoadVariance /></Suspense>} />
            <Route path="van-sales/cash-reconciliation/:id/collections/:colId" element={<Suspense fallback={<PageSkeleton />}><CashSessionCollectionDetail /></Suspense>} />
            <Route path="van-sales/cash-reconciliation/:id/deposits/:depId" element={<Suspense fallback={<PageSkeleton />}><CashSessionDepositDetail /></Suspense>} />
            <Route path="van-sales/cash-reconciliation/:id/variance" element={<Suspense fallback={<PageSkeleton />}><CashVariance /></Suspense>} />

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
