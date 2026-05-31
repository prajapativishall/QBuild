import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class AppColors {
  // Primary Colors - Red Brand (matching web app)
  static const Color primary = Color(0xFFDC2626);
  static const Color primaryDark = Color(0xFFB91C1C);
  static const Color primaryLight = Color(0xFFFCA5A5);
  static const Color accent = Color(0xFFDC2626);
  
  // Secondary Colors - Black/Gray
  static const Color secondary = Color(0xFF737373);
  static const Color secondaryDark = Color(0xFF525252);
  static const Color secondaryLight = Color(0xFFD4D4D4);
  
  // Success Colors - Emerald
  static const Color success = Color(0xFF10B981);
  static const Color successDark = Color(0xFF059669);
  static const Color successLight = Color(0xFF6EE7B7);
  
  // Error Colors - Rose
  static const Color error = Color(0xFFEF4444);
  static const Color errorDark = Color(0xFFDC2626);
  static const Color errorLight = Color(0xFFFCA5A5);
  
  // Warning Colors - Amber
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningDark = Color(0xFFD97706);
  static const Color warningLight = Color(0xFFFCD34D);
  
  // Info Colors
  static const Color info = Color(0xFFDC2626);
  static const Color infoDark = Color(0xFFB91C1C);
  
  // Background & Surface
  static const Color background = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFF5F5F5);
  static const Color onSurface = Color(0xFF757575);
  
  // Text Colors
  static const Color textPrimary = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color textHint = Color(0xFFBDBDBD);
  
  // Border & Divider
  static const Color divider = Color(0xFFE0E0E0);
  static const Color border = Color(0xFFE0E0E0);
}

class AppStrings {
  static const String appName = 'QBuild';
  static const String appVersion = '1.0.0';
  
  // Authentication
  static const String login = 'Login';
  static const String logout = 'Logout';
  static const String email = 'Email';
  static const String password = 'Password';
  static const String signIn = 'Sign In';
  static const String welcomeBack = 'Welcome Back';
  static const String enterCredentials = 'Enter your credentials to continue';
  
  // Dashboard
  static const String dashboard = 'Dashboard';
  static const String inspections = 'Inspections';
  static const String assignedInspections = 'Assigned Inspections';
  static const String noInspections = 'No inspections assigned';
  static const String startInspection = 'Start Inspection';
  
  // Checklist
  static const String checklist = 'Checklist';
  static const String submit = 'Submit';
  static const String save = 'Save';
  static const String cancel = 'Cancel';
  static const String yes = 'YES';
  static const String no = 'NO';
  static const String na = 'NA';
  static const String primaryQuestion = 'Primary Question';
  static const String secondaryQuestion = 'Secondary Question';
  
  // Responses
  static const String responses = 'Responses';
  static const String responseSubmitted = 'Response submitted successfully';
  static const String responseError = 'Error submitting response';
  static const String offlineMode = 'Offline Mode';
  static const String networkError = 'Network error';
  static const String responseYes = 'YES';
  static const String responseNo = 'NO';
  static const String responseNa = 'NA';
  
  // General
  static const String loading = 'Loading...';
  static const String error = 'Error';
  static const String success = 'Success';
  static const String retry = 'Retry';
  static const String close = 'Close';
  static const String ok = 'OK';
  static const String done = 'Done';
}

class AppConstants {
  // Detect platform and use appropriate base URL
  static String get baseUrl {
    if (kIsWeb) {
      return 'http://192.168.1.53:3000/api';
    } else {
      // Use laptop's IP for real devices (Android/iOS)
      // This allows physical devices to connect to development server
      return 'http://192.168.1.53:3000/api';
    }
  }
  
  static const String loginEndpoint = '/auth/login';
  static const String inspectionsEndpoint = '/inspections/user';
  static const String checklistEndpoint = '/checklist';
  static const String responsesEndpoint = '/responses/bulk';
  
  // Storage keys
  static const String tokenKey = 'auth_token';
  static const String userKey = 'user_data';
  static const String responsesKey = 'cached_responses';
  
  // Response values
  static const String responseYes = 'YES';
  static const String responseNo = 'NO';
  static const String responseNa = 'NA';
  static const String responseNC = 'NC';
  static const String responseNotes = 'NOTES';
  
  // NC (Non-Conformance) types
  static const String ncCritical = 'Critical';
  static const String ncMajor = 'Major';
  static const String ncMinor = 'Minor';
  static const String ncOFI = 'OFI'; // Opportunity For Improvement
  
  static const List<String> ncTypes = [
    ncCritical,
    ncMajor,
    ncMinor,
    ncOFI,
  ];
  
  // Question types
  static const String primaryType = 'PRIMARY';
  static const String secondaryType = 'SECONDARY';
  
  // Inspection statuses
  static const String statusPending = 'pending';
  static const String statusInProgress = 'in_progress';
  static const String statusCompleted = 'completed';
  
  // Network timeout
  static const int networkTimeout = 30000; // 30 seconds
  
  // Retry attempts
  static const int maxRetryAttempts = 3;
}
