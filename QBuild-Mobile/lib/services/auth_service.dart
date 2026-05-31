import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:logger/logger.dart';
import '../utils/constants.dart';

class AuthService extends ChangeNotifier {
  final Logger _logger = Logger();
  String? _token;
  Map<String, dynamic>? _user;
  bool _isAuthenticated = false;

  // Getters
  bool get isAuthenticated => _isAuthenticated;
  String? get token => _token;
  Map<String, dynamic>? get user => _user;

  AuthService() {
    _initializeAuth();
  }

  // Initialize authentication state
  Future<void> _initializeAuth() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(AppConstants.tokenKey);
      final userString = prefs.getString(AppConstants.userKey);

      if (token != null && userString != null) {
        _token = token;
        _user = jsonDecode(userString);
        _isAuthenticated = true;
        notifyListeners();
      }
    } catch (e) {
      _logger.e('Error initializing auth: $e');
    }
  }

  // Save authentication data
  Future<void> _saveAuthData(String token, Map<String, dynamic> user) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.tokenKey, token);
      await prefs.setString(AppConstants.userKey, jsonEncode(user));
      
      _token = token;
      _user = user;
      _isAuthenticated = true;
      notifyListeners();
    } catch (e) {
      _logger.e('Error saving auth data: $e');
    }
  }

  // Clear authentication data
  Future<void> _clearAuthData() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(AppConstants.tokenKey);
      await prefs.remove(AppConstants.userKey);
      await prefs.remove(AppConstants.responsesKey);
      
      _token = null;
      _user = null;
      _isAuthenticated = false;
      notifyListeners();
    } catch (e) {
      _logger.e('Error clearing auth data: $e');
    }
  }

  // Login method - calls backend API
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      _logger.i('Attempting login for user: $email');
      
      final response = await http.post(
        Uri.parse('${AppConstants.baseUrl}${AppConstants.loginEndpoint}'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );
      
      final data = jsonDecode(response.body);
      
      if (response.statusCode == 200 && data['success'] == true) {
        final token = data['data']['token'];
        final user = data['data']['user'];
        
        await _saveAuthData(token, user);
        
        _logger.i('Login successful for user: $email');
        
        return {
          'success': true,
          'message': 'Login successful',
          'data': {
            'token': token,
            'user': user,
          }
        };
      } else {
        return {
          'success': false,
          'message': data['message'] ?? 'Login failed',
        };
      }
    } catch (e) {
      _logger.e('Login error: $e');
      return {
        'success': false,
        'message': 'Network error: $e',
      };
    }
  }

  // Logout method
  Future<void> logout() async {
    try {
      _logger.i('Logging out user');
      await _clearAuthData();
      _logger.i('Logout successful');
    } catch (e) {
      _logger.e('Logout error: $e');
    }
  }

  // Check if token is valid (basic validation)
  bool _isTokenValid(String? token) {
    if (token == null || token.isEmpty) return false;
    
    // Basic token validation - in a real app, you'd check expiration
    return !token.contains('invalid') && token.length > 10;
  }

  // Refresh authentication state
  Future<void> refreshAuth() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(AppConstants.tokenKey);
      final userString = prefs.getString(AppConstants.userKey);

      if (_isTokenValid(token) && userString != null) {
        _token = token;
        _user = jsonDecode(userString);
        _isAuthenticated = true;
        notifyListeners();
      } else {
        await _clearAuthData();
      }
    } catch (e) {
      _logger.e('Error refreshing auth: $e');
      await _clearAuthData();
    }
  }

  // Update user data
  Future<void> updateUser(Map<String, dynamic> userData) async {
    try {
      if (_user != null) {
        _user = {..._user!, ...userData};
        await _saveAuthData(_token!, _user!);
      }
    } catch (e) {
      _logger.e('Error updating user data: $e');
    }
  }

  // Check if user has specific permission
  bool hasPermission(String permission) {
    if (_user == null) return false;
    
    final permissions = _user!['permissions'] as List<dynamic>?;
    return permissions?.contains(permission) ?? false;
  }

  // Check if user has specific role
  bool hasRole(String role) {
    if (_user == null) return false;
    return _user!['role'] == role;
  }

  // Get user display name
  String get displayName {
    if (_user == null) return 'Unknown User';
    return _user!['name'] ?? _user!['email'] ?? 'Unknown User';
  }

  // Get user email
  String get email {
    if (_user == null) return '';
    return _user!['email'] ?? '';
  }

  // Get user role
  String get role {
    if (_user == null) return '';
    return _user!['role'] ?? '';
  }
}
