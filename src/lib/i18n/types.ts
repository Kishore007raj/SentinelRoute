/**
 * i18n/types.ts — TypeScript types for the SentinelRoute i18n system.
 *
 * The Translation interface is derived from the English locale structure.
 * This ensures type safety: any access to a translation key that doesn't
 * exist in en/common.json will be a compile-time error.
 *
 * All future locale files MUST implement this exact shape.
 */

// ─── Supported language codes ─────────────────────────────────────────────────

export const SUPPORTED_LOCALES = [
  "en", // English
  "hi", // Hindi
  "ta", // Tamil
  "te", // Telugu
  "kn", // Kannada
  "ml", // Malayalam
  "mr", // Marathi
  "bn", // Bengali
  "gu", // Gujarati
  "pa", // Punjabi
  "or", // Odia
] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";
export const FALLBACK_LOCALE: SupportedLocale = "en";

// ─── Language metadata ────────────────────────────────────────────────────────

export interface LocaleInfo {
  code:      SupportedLocale;
  name:      string;   // name in English
  nativeName: string;  // name in its own script
  direction: "ltr" | "rtl";
  script:    string;
}

export const LOCALE_INFO: Record<SupportedLocale, LocaleInfo> = {
  en: { code: "en", name: "English",    nativeName: "English",    direction: "ltr", script: "Latin"    },
  hi: { code: "hi", name: "Hindi",      nativeName: "हिन्दी",       direction: "ltr", script: "Devanagari" },
  ta: { code: "ta", name: "Tamil",      nativeName: "தமிழ்",        direction: "ltr", script: "Tamil"    },
  te: { code: "te", name: "Telugu",     nativeName: "తెలుగు",        direction: "ltr", script: "Telugu"   },
  kn: { code: "kn", name: "Kannada",    nativeName: "ಕನ್ನಡ",         direction: "ltr", script: "Kannada"  },
  ml: { code: "ml", name: "Malayalam",  nativeName: "മലയാളം",        direction: "ltr", script: "Malayalam"},
  mr: { code: "mr", name: "Marathi",    nativeName: "मराठी",          direction: "ltr", script: "Devanagari" },
  bn: { code: "bn", name: "Bengali",    nativeName: "বাংলা",          direction: "ltr", script: "Bengali"  },
  gu: { code: "gu", name: "Gujarati",   nativeName: "ગુજરાતી",         direction: "ltr", script: "Gujarati" },
  pa: { code: "pa", name: "Punjabi",    nativeName: "ਪੰਜਾਬੀ",          direction: "ltr", script: "Gurmukhi" },
  or: { code: "or", name: "Odia",       nativeName: "ଓଡ଼ିଆ",           direction: "ltr", script: "Odia"     },
};

// ─── Translation shape ────────────────────────────────────────────────────────
// Mirrors src/locales/en/common.json exactly.

export interface Translation {
  app: {
    name:       string;
    tagline:    string;
    loading:    string;
    error:      string;
    save:       string;
    cancel:     string;
    back:       string;
    next:       string;
    submit:     string;
    confirm:    string;
    close:      string;
    search:     string;
    filter:     string;
    refresh:    string;
    logout:     string;
    settings:   string;
    dashboard:  string;
    analytics:  string;
  };
  nav: {
    dashboard:         string;
    shipments:         string;
    createShipment:    string;
    yourOrders:        string;
    routeIntelligence: string;
    analytics:         string;
    companyProfile:    string;
    settings:          string;
    adminPanel:        string;
  };
  company: {
    register:              string;
    companyName:           string;
    companyType:           string;
    gstNumber:             string;
    panNumber:             string;
    website:               string;
    email:                 string;
    phone:                 string;
    address:               string;
    fleetSize:             string;
    operatingStates:       string;
    cargoCategories:       string;
    status:                string;
    pending:               string;
    approved:              string;
    rejected:              string;
    suspended:             string;
    trustScore:            string;
    verificationPending:   string;
    applicationSubmitted:  string;
    awaitingVerification:  string;
    documentsReceived:     string;
  };
  logistics: {
    shipment:          string;
    shipments:         string;
    shipmentCode:      string;
    driver:            string;
    dispatcher:        string;
    vehicle:           string;
    fleet:             string;
    riskScore:         string;
    riskLevel:         string;
    incident:          string;
    delay:             string;
    eta:               string;
    route:             string;
    cargo:             string;
    cargoType:         string;
    operationsManager: string;
    origin:            string;
    destination:       string;
    departure:         string;
    arrival:           string;
    distance:          string;
    duration:          string;
    status:            string;
    active:            string;
    atRisk:            string;
    completed:         string;
    dispatch:          string;
    dispatchShipment:  string;
    createShipment:    string;
    vehicleType:       string;
    urgency:           string;
    low:               string;
    medium:            string;
    high:              string;
    critical:          string;
    fastest:           string;
    balanced:          string;
    safest:            string;
    recommended:       string;
    riskBreakdown:     string;
    traffic:           string;
    weather:           string;
    disruption:        string;
    cargoSensitivity:  string;
    predictiveAlert:   string;
    confidence:        string;
    highRiskAvoided:   string;
    activeNow:         string;
    avgRisk:           string;
  };
  documents: {
    upload:             string;
    uploaded:           string;
    missing:            string;
    replace:            string;
    gstCertificate:     string;
    panDocument:        string;
    insuranceProof:     string;
    transportLicense:   string;
    fleetInsurance:     string;
    submitVerification: string;
    verified:           string;
    unverified:         string;
  };
  admin: {
    reviewApplication:    string;
    approve:              string;
    reject:               string;
    suspend:              string;
    requestClarification: string;
    companyApplications:  string;
    superAdmin:           string;
    reviewNote:           string;
  };
  auth: {
    signIn:             string;
    signUp:             string;
    signOut:            string;
    email:              string;
    password:           string;
    forgotPassword:     string;
    createAccount:      string;
    alreadyHaveAccount: string;
    noAccount:          string;
  };
  errors: {
    required:        string;
    invalidEmail:    string;
    invalidGst:      string;
    invalidPan:      string;
    networkError:    string;
    unauthorized:    string;
    forbidden:       string;
    notFound:        string;
    serverError:     string;
    fileTooLarge:    string;
    invalidFileType: string;
  };
  notifications: {
    riskAlert:         string;
    dispatchConfirm:   string;
    routeDisruption:   string;
    completionSummary: string;
    weatherWarning:    string;
    analyticsDigest:   string;
  };
  workforce: {
    dashboard:                  string;
    drivers:                    string;
    vehicles:                   string;
    users:                      string;
    totalDrivers:               string;
    activeDrivers:              string;
    availableVehicles:          string;
    recentActivity:             string;
    upcomingExpirations:        string;
    addDriver:                  string;
    addVehicle:                 string;
    inviteUser:                 string;
    searchDrivers:              string;
    searchVehicles:             string;
    active:                     string;
    inactive:                   string;
    suspended:                  string;
    available:                  string;
    assigned:                   string;
    maintenance:                string;
    driverProfile:              string;
    vehicleDetails:             string;
    personalInformation:        string;
    licenseInformation:         string;
    assignmentInformation:      string;
    auditHistory:               string;
    shipmentHistory:            string;
    communicationLog:           string;
    insuranceInformation:       string;
    permitInformation:          string;
    fitnessInformation:         string;
    liveTracking:               string;
    totalVehicles:              string;
    assignedVehicles:           string;
    inactiveVehicles:           string;
    companyUsers:               string;
    allStatuses:                string;
    noRecentActivity:           string;
    noUpcomingExpirations:      string;
    driverLicenses:             string;
    vehicleDocuments:           string;
    noAuditRecords:             string;
    noVehicleAssigned:          string;
    noDriverAssigned:           string;
    fullName:                   string;
    employeeId:                 string;
    phone:                      string;
    email:                      string;
    bloodGroup:                 string;
    address:                    string;
    languages:                  string;
    licenseNumber:              string;
    licenseExpiry:              string;
    assignedVehicle:            string;
    preferredLanguage:          string;
    vehicleNumber:              string;
    vehicleType:                string;
    capacity:                   string;
    fuelType:                   string;
    status:                     string;
    currentDriver:              string;
    policyNumber:               string;
    expiryDate:                 string;
    permitExpiry:               string;
    fitnessExpiry:              string;
    event:                      string;
    actor:                      string;
    target:                     string;
    when:                       string;
    driver:                     string;
    vehicle:                    string;
    insurance:                  string;
    permit:                     string;
    fitness:                    string;
    expired:                    string;
    expiresToday:               string;
    daysLeft:                   string;
    lastTenEvents:              string;
    expiringIn30Days:           string;
    operations:                 string;
    workforce:                  string;
    failedToLoadDrivers:        string;
    failedToLoadVehicles:       string;
    failedToLoadUsers:          string;
    failedToLoadDashboard:      string;
    failedToLoadDriverProfile:  string;
    failedToLoadVehicleProfile: string;
    retry:                      string;
    goBack:                     string;
    companyManagerRequired:     string;
    activeOf:                   string;
    readyToAssign:              string;
    currentlyInUse:             string;
    offlineOrMaintenance:       string;
    shipmentHistoryComingSoon:  string;
    communicationLogComingSoon: string;
    liveTrackingComingSoon:     string;
  };
  intelligence: {
    riskCenter:                  string;
    riskCenterSubtitle:          string;
    incidentCenter:              string;
    incidentCenterSubtitle:      string;
    corridorIntelligence:        string;
    corridorIntelligenceSubtitle: string;
    operationalHeatmap:          string;
    operationalHeatmapSubtitle:  string;
    routeIntelligence:           string;
    routeIntelligenceSubtitle:   string;
    companyRiskScore:            string;
    activeRisks:                 string;
    criticalShipments:           string;
    riskTrend:                   string;
    operationalAlerts:           string;
    noActiveAlerts:              string;
    loadingAlerts:               string;
    activeIncidents:             string;
    noActiveIncidents:           string;
    loadingIncidents:            string;
    searchIncidents:             string;
    allSeverities:               string;
    impactScore:                 string;
    loadingCorridors:            string;
    historicalReliability:       string;
    avgDelay:                    string;
    weatherTrend:                string;
    roadQuality:                 string;
    incidentDensity:             string;
    criticalRisk:                string;
    highRisk:                    string;
    mediumRisk:                  string;
    avgRiskFactors:              string;
    routeSelectionHistory:       string;
    activeAlerts:                string;
    noActiveAlertsShort:         string;
    systemInsight:               string;
    basedOnShipments:            string;
    avgRiskScore:                string;
    withinSafeRange:             string;
    elevated:                    string;
    dominantRiskFactor:          string;
    currentlyAtRisk:             string;
    noDataYet:                   string;
    noDataYetSubtitle:           string;
    allFiguresDerived:           string;
    action:                      string;
    shipment:                    string;
    confidence:                  string;
    highRiskShipments:           string;
    avgOperationalRisk:          string;
    avgDelayProbability:         string;
    avgEtaConfidence:            string;
  };
}
