import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:go_router/go_router.dart';

import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/inspection_list_screen.dart';
import 'screens/checklist_screen.dart';
import 'screens/inbox_screen.dart';
import 'screens/inspection_domains_screen.dart';
import 'screens/inspection_subdomains_screen.dart';
import 'screens/inspection_queries_screen.dart';
import 'screens/rejected_inbox_screen.dart';
import 'services/auth_service.dart';
import 'services/api_service.dart';
import 'utils/constants.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize shared preferences
  await SharedPreferences.getInstance();
  
  runApp(const QBuildApp());
}

class QBuildApp extends StatelessWidget {
  const QBuildApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        ChangeNotifierProvider(create: (_) => ApiService()),
      ],
      child: MaterialApp.router(
        title: 'QBuild',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          primarySwatch: Colors.blue,
          primaryColor: AppColors.primary,
          scaffoldBackgroundColor: Colors.white,
          appBarTheme: const AppBarTheme(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            elevation: 2,
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
          textButtonTheme: TextButtonThemeData(
            style: TextButton.styleFrom(
              foregroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            ),
          ),
        ),
        routerConfig: GoRouter(
          initialLocation: '/login',
          routes: [
            GoRoute(
              path: '/login',
              builder: (context, state) => const LoginScreen(),
            ),
            GoRoute(
              path: '/dashboard',
              builder: (context, state) => const DashboardScreen(),
              routes: [
                GoRoute(
                  path: 'inspections',
                  builder: (context, state) => const InspectionListScreen(),
                ),
                GoRoute(
                  path: 'inbox',
                  builder: (context, state) => const InboxScreen(),
                ),
                GoRoute(
                  path: 'rejected-inbox',
                  builder: (context, state) => const RejectedInboxScreen(),
                ),
                GoRoute(
                  path: 'checklist/:inspectionId',
                  builder: (context, state) {
                    final inspectionIdParam = state.pathParameters['inspectionId']!;
                    int inspectionId;
                    if (inspectionIdParam.contains('inspection_')) {
                      // Extract number after 'inspection_'
                      final match = RegExp(r'inspection_(\d+)').firstMatch(inspectionIdParam);
                      if (match != null) {
                        inspectionId = int.parse(match.group(1)!);
                      } else {
                        inspectionId = int.parse(inspectionIdParam);
                      }
                    } else {
                      inspectionId = int.parse(inspectionIdParam);
                    }
                    return ChecklistScreen(
                      inspectionId: inspectionId,
                    );
                  },
                ),
                GoRoute(
                  path: 'inspection/:inspectionId/domains',
                  builder: (context, state) {
                    final inspectionIdParam = state.pathParameters['inspectionId']!;
                    int inspectionId;
                    if (inspectionIdParam.contains('inspection_')) {
                      // Extract number after 'inspection_'
                      final match = RegExp(r'inspection_(\d+)').firstMatch(inspectionIdParam);
                      if (match != null) {
                        inspectionId = int.parse(match.group(1)!);
                      } else {
                        inspectionId = int.parse(inspectionIdParam);
                      }
                    } else {
                      inspectionId = int.parse(inspectionIdParam);
                    }
                    return InspectionDomainsScreen(
                      inspectionId: inspectionId,
                    );
                  },
                ),
                GoRoute(
                  path: 'inspection/:inspectionId/domains/:domainId/subdomains',
                  builder: (context, state) {
                    final inspectionIdParam = state.pathParameters['inspectionId']!;
                    final domainIdParam = state.pathParameters['domainId']!;
                    int inspectionId;
                    if (inspectionIdParam.contains('inspection_')) {
                      // Extract number after 'inspection_'
                      final match = RegExp(r'inspection_(\d+)').firstMatch(inspectionIdParam);
                      if (match != null) {
                        inspectionId = int.parse(match.group(1)!);
                      } else {
                        inspectionId = int.parse(inspectionIdParam);
                      }
                    } else {
                      inspectionId = int.parse(inspectionIdParam);
                    }
                    int domainId;
                    if (domainIdParam.contains('domain_')) {
                      // Extract number after 'domain_'
                      final match = RegExp(r'domain_(\d+)').firstMatch(domainIdParam);
                      if (match != null) {
                        domainId = int.parse(match.group(1)!);
                      } else {
                        domainId = int.parse(domainIdParam);
                      }
                    } else {
                      domainId = int.parse(domainIdParam);
                    }
                    return InspectionSubDomainsScreen(
                      inspectionId: inspectionId,
                      domainId: domainId,
                    );
                  },
                ),
                GoRoute(
                  path: 'inspection/:inspectionId/domains/:domainId/subdomains/:subDomainId/queries',
                  builder: (context, state) {
                    final extra = state.extra as Map<String, dynamic>?;
                    final inspectionIdParam = state.pathParameters['inspectionId']!;
                    int inspectionId;
                    if (inspectionIdParam.contains('inspection_')) {
                      // Extract number after 'inspection_'
                      final match = RegExp(r'inspection_(\d+)').firstMatch(inspectionIdParam);
                      if (match != null) {
                        inspectionId = int.parse(match.group(1)!);
                      } else {
                        inspectionId = int.parse(inspectionIdParam);
                      }
                    } else {
                      inspectionId = int.parse(inspectionIdParam);
                    }
                    final domainIdParam = state.pathParameters['domainId']!;
                    final subDomainIdParam = state.pathParameters['subDomainId']!;
                    int domainId;
                    int subDomainId;
                    
                    // Parse domainId
                    if (domainIdParam.contains('domain_')) {
                      final match = RegExp(r'domain_(\d+)').firstMatch(domainIdParam);
                      if (match != null) {
                        domainId = int.parse(match.group(1)!);
                      } else {
                        domainId = int.parse(domainIdParam);
                      }
                    } else {
                      domainId = int.parse(domainIdParam);
                    }
                    
                    // Parse subDomainId
                    if (subDomainIdParam.contains('subdomain_')) {
                      final match = RegExp(r'subdomain_(\d+)').firstMatch(subDomainIdParam);
                      if (match != null) {
                        subDomainId = int.parse(match.group(1)!);
                      } else {
                        subDomainId = int.parse(subDomainIdParam);
                      }
                    } else {
                      subDomainId = int.parse(subDomainIdParam);
                    }
                    return InspectionQueriesScreen(
                      key: ValueKey('inspection_$inspectionId-domain_$domainId-subdomain_$subDomainId'),
                      inspectionId: inspectionId,
                      domainId: domainId,
                      subDomainId: subDomainId,
                      subDomainIds: extra?['subDomainIds'] as List<int>?,
                      accumulatedResponses: extra?['accumulatedResponses'] as Map<int, Map<String, dynamic>>?,
                    );
                  },
                ),
              ],
            ),
          ],
          redirect: (context, state) {
            final authService = context.read<AuthService>();
            final isAuthenticated = authService.isAuthenticated;
            
            // If not authenticated and not on login page, redirect to login
            if (!isAuthenticated && !state.uri.path.startsWith('/login')) {
              return '/login';
            }
            
            // If authenticated and on login page, redirect to dashboard
            if (isAuthenticated && state.uri.path == '/login') {
              return '/dashboard';
            }
            
            return null;
          },
        ),
      ),
    );
  }
}
