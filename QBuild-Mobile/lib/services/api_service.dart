import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';
import 'package:logger/logger.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';

class ApiService extends ChangeNotifier {
  final Dio _dio;
  final Logger _logger = Logger();
  String? _token;
  bool _isConnected = true;

  ApiService() : _dio = Dio(BaseOptions(
    baseUrl: AppConstants.baseUrl,
    connectTimeout: const Duration(milliseconds: AppConstants.networkTimeout),
    receiveTimeout: const Duration(milliseconds: AppConstants.networkTimeout),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  )) {
    _initializeInterceptors();
    _loadToken();
  }

  // Getters
  bool get isConnected => _isConnected;
  String? get token => _token;

  // Initialize Dio interceptors
  void _initializeInterceptors() {
    // Request interceptor to add auth token
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (_token != null) {
          options.headers['Authorization'] = 'Bearer $_token';
        }
        _logger.d('API Request: ${options.method} ${options.path}');
        return handler.next(options);
      },
      onError: (error, handler) {
        _logger.e('Request Error: ${error.message}');
        return handler.next(error);
      },
    ));

    // Response interceptor for error handling
    _dio.interceptors.add(InterceptorsWrapper(
      onResponse: (response, handler) {
        _logger.d('API Response: ${response.statusCode} ${response.requestOptions.path}');
        _isConnected = true;
        return handler.next(response);
      },
      onError: (error, handler) async {
        _logger.e('Response Error: ${error.message}');
        
        if (error.type == DioExceptionType.connectionError ||
            error.type == DioExceptionType.connectionTimeout ||
            error.type == DioExceptionType.receiveTimeout) {
          _isConnected = false;
          notifyListeners();
        }

        // Handle 401 Unauthorized
        if (error.response?.statusCode == 401) {
          await _clearToken();
          // You might want to navigate to login here
        }

        return handler.next(error);
      },
    ));
  }

  // Token management
  Future<void> _loadToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _token = prefs.getString(AppConstants.tokenKey);
      if (_token != null) {
        _dio.options.headers['Authorization'] = 'Bearer $_token';
      }
    } catch (e) {
      _logger.e('Error loading token: $e');
    }
  }

  Future<void> _saveToken(String token) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.tokenKey, token);
      _token = token;
      _dio.options.headers['Authorization'] = 'Bearer $token';
    } catch (e) {
      _logger.e('Error saving token: $e');
    }
  }

  Future<void> _clearToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(AppConstants.tokenKey);
      await prefs.remove(AppConstants.userKey);
      _token = null;
      _dio.options.headers.remove('Authorization');
    } catch (e) {
      _logger.e('Error clearing token: $e');
    }
  }

  // Generic API methods
  Future<Map<String, dynamic>> _makeRequest(
    String method,
    String endpoint, {
    Map<String, dynamic>? data,
    Map<String, dynamic>? queryParameters,
    int retryCount = 0,
  }) async {
    try {
      late Response response;
      
      switch (method.toUpperCase()) {
        case 'GET':
          response = await _dio.get(endpoint, queryParameters: queryParameters);
          break;
        case 'POST':
          response = await _dio.post(endpoint, data: data);
          break;
        case 'PUT':
          response = await _dio.put(endpoint, data: data);
          break;
        case 'DELETE':
          response = await _dio.delete(endpoint);
          break;
        default:
          throw Exception('Unsupported HTTP method: $method');
      }

      return response.data;
    } on DioException catch (e) {
      _logger.e('DioException: ${e.type} - ${e.message}');
      
      // Retry logic for network errors
      if (retryCount < AppConstants.maxRetryAttempts &&
          (e.type == DioExceptionType.connectionError ||
           e.type == DioExceptionType.connectionTimeout ||
           e.type == DioExceptionType.receiveTimeout)) {
        _logger.d('Retrying request... Attempt ${retryCount + 1}');
        await Future.delayed(Duration(seconds: 2 * (retryCount + 1)));
        return _makeRequest(method, endpoint, data: data, queryParameters: queryParameters, retryCount: retryCount + 1);
      }

      // Handle different error types
      if (e.response != null) {
        throw _handleApiError(e.response!);
      } else {
        throw Exception('Network error: ${e.message}');
      }
    } catch (e) {
      _logger.e('Unexpected error: $e');
      throw Exception('Unexpected error: $e');
    }
  }

  Exception _handleApiError(Response response) {
    final statusCode = response.statusCode;
    final data = response.data;
    
    String message = 'Unknown error occurred';
    
    if (data is Map<String, dynamic>) {
      message = data['error']?['message'] ?? data['message'] ?? message;
    }

    switch (statusCode) {
      case 400:
        return Exception('Bad request: $message');
      case 401:
        return Exception('Unauthorized: $message');
      case 403:
        return Exception('Forbidden: $message');
      case 404:
        return Exception('Not found: $message');
      case 422:
        return Exception('Validation error: $message');
      case 500:
        return Exception('Server error: $message');
      default:
        return Exception('HTTP $statusCode: $message');
    }
  }

  // Specific API methods
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await _makeRequest('POST', AppConstants.loginEndpoint, data: {
        'email': email,
        'password': password,
      });

      if (response['success'] == true && response['data'] != null) {
        final token = response['data']['token'];
        final user = response['data']['user'];
        
        await _saveToken(token);
        
        // Save user data
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(AppConstants.userKey, jsonEncode(user));
        
        return response;
      } else {
        throw Exception(response['message'] ?? 'Login failed');
      }
    } catch (e) {
      _logger.e('Login error: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getUserInspections() async {
    try {
      final response = await _makeRequest('GET', AppConstants.inspectionsEndpoint);
      return response;
    } catch (e) {
      _logger.e('Get inspections error: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getChecklist(int inspectionId) async {
    try {
      final response = await _makeRequest('GET', '${AppConstants.checklistEndpoint}/$inspectionId');
      return response;
    } catch (e) {
      _logger.e('Get checklist error: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>> get(String endpoint, {Map<String, dynamic>? queryParameters}) async {
    return _makeRequest('GET', endpoint, queryParameters: queryParameters);
  }

  Future<Map<String, dynamic>> post(String endpoint, {Map<String, dynamic>? data}) async {
    return _makeRequest('POST', endpoint, data: data);
  }

  Future<Map<String, dynamic>> put(String endpoint, {Map<String, dynamic>? data}) async {
    return _makeRequest('PUT', endpoint, data: data);
  }

  Future<Map<String, dynamic>> delete(String endpoint) async {
    return _makeRequest('DELETE', endpoint);
  }

  // Mobile app specific APIs
  Future<Map<String, dynamic>> getDashboard() async {
    try {
      final response = await _makeRequest('GET', '/mobile/dashboard');
      return response;
    } catch (e) {
      _logger.e('Get dashboard error: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getInbox() async {
    try {
      final response = await _makeRequest('GET', '/mobile/inbox');
      return response;
    } catch (e) {
      _logger.e('Get inbox error: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>> acceptInspection(int inspectionId) async {
    try {
      final response = await _makeRequest('POST', '/mobile/inbox/$inspectionId/accept');
      return response;
    } catch (e) {
      _logger.e('Accept inspection error: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getInspectionDomains(int inspectionId) async {
    try {
      final response = await _makeRequest('GET', '/mobile/inspections/$inspectionId/domains');
      return response;
    } catch (e) {
      _logger.e('Get inspection domains error: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getSubDomainQueries(int inspectionId, int subDomainId, int domainId) async {
    try {
      final response = await _makeRequest('GET', '/mobile/inspections/$inspectionId/domains/$domainId/subdomains/$subDomainId/queries');
      return response;
    } catch (e) {
      _logger.e('Get subdomain queries error: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>> submitResponse(Map<String, dynamic> data) async {
    try {
      final response = await _makeRequest('POST', '/responses', data: data);
      return response;
    } catch (e) {
      _logger.e('Submit response error: $e');
      rethrow;
    }
  }

  // Get hierarchical inspection data with responses for spider charts
  Future<Map<String, dynamic>> getInspectionHierarchy(int inspectionId) async {
    try {
      final response = await _makeRequest('GET', '/mobile/inspections/$inspectionId/hierarchy');
      return response;
    } catch (e) {
      _logger.e('Get inspection hierarchy error: $e');
      rethrow;
    }
  }

  // Get project hierarchy with all phases (project->phases->domains->subdomains->queries->responses)
  Future<Map<String, dynamic>> getProjectHierarchy(int projectId) async {
    try {
      final response = await _makeRequest('GET', '/mobile/projects/$projectId/hierarchy');
      return response;
    } catch (e) {
      _logger.e('Get project hierarchy error: $e');
      rethrow;
    }
  }

  // Submit response for a specific query in an inspection
  Future<Map<String, dynamic>> submitQueryResponse(int inspectionId, int queryId, String responseValue, int subDomainId, {String? comments, int? domainId, int? phase}) async {
    try {
      final response = await _makeRequest(
        'POST',
        '/mobile/inspections/$inspectionId/queries/$queryId/response',
        data: {
          'response': responseValue,
          'comments': comments,
          'subDomainId': subDomainId,
          'domainId': domainId,
          'phase': phase,
        },
      );
      return response;
    } catch (e) {
      _logger.e('Submit query response error: $e');
      rethrow;
    }
  }

  // Submit a sub-domain for an inspection
  Future<Map<String, dynamic>> submitSubDomain(int inspectionId, int subDomainId, {int? domainId}) async {
    try {
      final response = await _makeRequest(
        'POST',
        '/mobile/inspections/$inspectionId/subdomains/$subDomainId/submit',
        data: {
          'domainId': domainId,
        },
      );
      return response;
    } catch (e) {
      _logger.e('Submit subdomain error: $e');
      rethrow;
    }
  }

  // Final inspection submission from domains screen
  Future<Map<String, dynamic>> submitFinalInspection(int inspectionId, int domainId) async {
    try {
      _logger.i('=== FINAL INSPECTION SUBMISSION API CALL ===');
      _logger.i('Inspection ID: $inspectionId, Domain ID: $domainId');
      
      final response = await _makeRequest(
        'POST',
        '/mobile/inspections/$inspectionId/final-submit',
        data: {
          'domainId': domainId,
        },
      );
      
      _logger.i('Final inspection submission response: $response');
      return response;
    } catch (e) {
      _logger.e('Final inspection submission error: $e');
      rethrow;
    }
  }

  // Get rejected inspections for inspector inbox
  Future<Map<String, dynamic>> getRejectedInspections() async {
    try {
      final response = await _dio.get('/mobile/rejected-inspections');
      return response.data;
    } catch (e) {
      _logger.e('Get rejected inspections error: $e');
      rethrow;
    }
  }

  // Accept rejection and reopen inspection for editing
  Future<Map<String, dynamic>> acceptRejection(int inspectionId) async {
    try {
      final response = await _dio.post('/mobile/rejected-inspections/$inspectionId/accept');
      return response.data;
    } catch (e) {
      _logger.e('Accept rejection error: $e');
      rethrow;
    }
  }

  // Logout method
  Future<void> logout() async {
    await _clearToken();
  }

  // Check network connectivity
  Future<bool> checkConnectivity() async {
    try {
      final result = await InternetAddress.lookup('google.com');
      _isConnected = result.isNotEmpty && result[0].rawAddress.isNotEmpty;
      notifyListeners();
      return _isConnected;
    } catch (e) {
      _isConnected = false;
      notifyListeners();
      return false;
    }
  }

  // Upload inspection photo
  Future<Map<String, dynamic>> uploadInspectionPhoto({
    required int inspectionId,
    required int domainId,
    required int queryId,
    required int subDomainId,
    required int phase,
    required File photoFile,
  }) async {
    _logger.i('=== PHOTO UPLOAD FUNCTION CALLED ===');
    _logger.i('Inspection ID: $inspectionId, Domain ID: $domainId, Query ID: $queryId, Phase: $phase');
    
    try {
      // Handle Flutter Web blob files differently
      if (kIsWeb) {
        _logger.i('Photo file path (Web): ${photoFile.path}');
        _logger.i('Photo is a blob file (Web platform)');
      } else {
        _logger.i('Photo file path (Mobile): ${photoFile.path}');
        _logger.i('Photo file exists: ${photoFile.existsSync()}');
        _logger.i('Photo file size: ${photoFile.lengthSync()} bytes');
      }
      
      _logger.i('Reading photo file bytes...');
      Uint8List photoBytes;
      
      // Universal approach: try XFile.readBytes() first, then fallback to File.readAsBytes()
      if (photoFile is XFile) {
        photoBytes = await (photoFile as XFile).readAsBytes();
        _logger.i('Photo bytes read successfully via XFile: ${photoBytes.length} bytes');
      } else {
        photoBytes = await photoFile.readAsBytes();
        _logger.i('Photo bytes read successfully via File: ${photoBytes.length} bytes');
      }
      
      _logger.i('Creating MultipartFile...');
      final filename = kIsWeb 
        ? '${DateTime.now().millisecondsSinceEpoch}_photo.jpg'
        : '${DateTime.now().millisecondsSinceEpoch}_${photoFile.path.split('/').last}';
      
      final photoMultipartFile = MultipartFile.fromBytes(photoBytes, filename: filename);
      _logger.i('MultipartFile created successfully: ${photoMultipartFile.filename}');
      
      _logger.i('Creating FormData...');
      final formData = FormData.fromMap({
        'photo': photoMultipartFile,
        'query_id': queryId,
        'domain_id': domainId,
        'phase': phase,
        'sub_domain_id': subDomainId,
      });
      _logger.i('FormData created successfully');

      _logger.i('Making photo upload request to /mobile/inspections/$inspectionId/upload-photo');
      _logger.i('FormData fields: ${formData.fields}');
      _logger.i('FormData files: ${formData.files.map((f) => '${f.key}: ${f.value.filename}').toList()}');
      
      final response = await _dio.post(
        '/mobile/inspections/$inspectionId/upload-photo',
        data: formData,
        options: Options(
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        ),
      );

      _logger.i('Photo uploaded successfully: ${response.data}');
      return response.data as Map<String, dynamic>;
    } catch (e) {
      _logger.e('=== PHOTO UPLOAD ERROR ===');
      _logger.e('Error: $e');
      _logger.e('Stack trace: ${StackTrace.current}');
      rethrow;
    }
  }

  // Submit bulk responses for a sub-domain (inspection queries screen)
  Future<Map<String, dynamic>> submitSubDomainResponses({
    required int inspectionId,
    required int subDomainId,
    required int domainId,
    required List<Map<String, dynamic>> responses,
  }) async {
    try {
      _logger.i('=== FRONTEND SUBMISSION DEBUG ===');
      _logger.i('Submitting bulk responses for inspection $inspectionId, sub-domain $subDomainId');
      _logger.i('Submission data: inspectionId: $inspectionId, subDomainId: $subDomainId, domainId: $domainId, responsesCount: ${responses.length}');

      final requestData = {
        'responses': responses,
        'domainId': domainId,
      };
      
      _logger.i('Request data being sent: $requestData');

      final response = await _dio.post(
        '/mobile/inspections/$inspectionId/subdomains/$subDomainId/submit',
        data: requestData,
      );

      _logger.i('Bulk responses submitted successfully: ${response.data}');
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      _logger.e('Submit responses error: ${e.message}');
      if (e.response?.statusCode == 401) {
        throw Exception('Unauthorized: Authentication required');
      }
      throw Exception('Failed to submit responses: ${e.message}');
    } catch (e) {
      _logger.e('Submit responses error: $e');
      throw Exception('Failed to submit responses: $e');
    }
  }

  // Generic bulk responses submission (checklist screen)
  Future<Map<String, dynamic>> submitBulkResponses(Map<String, dynamic> data) async {
    try {
      final inspectionId = data['inspection_id'];
      final subDomainId = data['responses'][0]['sub_domain_id'];
      final domainId = data['responses'][0]['domain_id'];
      
      _logger.i('Submitting sub-domain responses: inspection=$inspectionId, subDomain=$subDomainId, domain=$domainId');
      
      final response = await _dio.post(
        '/mobile/inspections/$inspectionId/subdomains/$subDomainId/submit',
        data: {
          'domainId': domainId,
          'responses': data['responses'],
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      _logger.e('Submit sub-domain responses error: ${e.message}');
      if (e.response?.statusCode == 401) {
        throw Exception('Unauthorized: Authentication required');
      }
      if (e.response?.statusCode == 400) {
        final responseData = e.response?.data;
        String message = 'Submission failed';
        
        // Handle different response data types
        if (responseData != null) {
          if (responseData is Map<String, dynamic>) {
            message = responseData['message'] ?? 'Submission failed';
          } else if (responseData is Map && responseData.containsKey('message')) {
            message = responseData['message'].toString();
          } else {
            message = responseData.toString();
          }
        }
        
        throw Exception(message);
      }
      throw Exception('Failed to submit sub-domain responses: $e');
    } catch (e) {
      _logger.e('Submit sub-domain responses error: $e');
      throw Exception('Failed to submit sub-domain responses: $e');
    }
  }
}
