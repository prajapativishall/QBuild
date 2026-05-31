import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Local cache service to store submitted sub-domain responses+photos locally.
/// This ensures that after submitting a sub-domain, the inspector can still
/// view their responses and photos even when working on other sub-domains,
/// without relying on network requests.
class LocalCacheService {
  static const String _cachePrefix = 'subdomain_cache_';
  static const String _indexKey = 'subdomain_cache_index';

  /// Save submitted sub-domain data to local cache
  static Future<void> cacheSubDomainData({
    required int inspectionId,
    required int subDomainId,
    required int domainId,
    required List<Map<String, dynamic>> responses,
    required Map<int, List<String>> uploadedPhotos,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final cacheKey = '$_cachePrefix${inspectionId}_${subDomainId}_$domainId';
    
    final data = {
      'inspectionId': inspectionId,
      'subDomainId': subDomainId,
      'domainId': domainId,
      'responses': responses,
      'uploadedPhotos': uploadedPhotos.map((k, v) => MapEntry(k.toString(), v)),
      'cachedAt': DateTime.now().toIso8601String(),
    };
    
    await prefs.setString(cacheKey, jsonEncode(data));
    
    // Update index so we can list all cached sub-domains for an inspection
    final indexKey = '$_indexKey$inspectionId';
    final indexJson = prefs.getString(indexKey) ?? '[]';
    final List<dynamic> index = jsonDecode(indexJson);
    
    final entry = {'subDomainId': subDomainId, 'domainId': domainId, 'cacheKey': cacheKey};
    final existingIdx = index.indexWhere((e) =>
      e['subDomainId'] == subDomainId && e['domainId'] == domainId);
    
    if (existingIdx >= 0) {
      index[existingIdx] = entry;
    } else {
      index.add(entry);
    }
    
    await prefs.setString(indexKey, jsonEncode(index));
  }

  /// Load cached sub-domain data
  static Future<Map<String, dynamic>?> getCachedSubDomainData({
    required int inspectionId,
    required int subDomainId,
    required int domainId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final cacheKey = '$_cachePrefix${inspectionId}_${subDomainId}_$domainId';
    final json = prefs.getString(cacheKey);
    
    if (json == null) return null;
    
    try {
      final data = jsonDecode(json) as Map<String, dynamic>;
      
      // Convert keys back to int
      if (data['uploadedPhotos'] != null) {
        final photosMap = <int, List<String>>{};
        (data['uploadedPhotos'] as Map<String, dynamic>).forEach((key, value) {
          photosMap[int.parse(key)] = List<String>.from(value);
        });
        data['uploadedPhotos'] = photosMap;
      }
      
      return data;
    } catch (e) {
      return null;
    }
  }

  /// Get list of all cached sub-domains for an inspection
  static Future<List<Map<String, dynamic>>> getCachedSubDomains(int inspectionId) async {
    final prefs = await SharedPreferences.getInstance();
    final indexKey = '$_indexKey$inspectionId';
    final json = prefs.getString(indexKey);
    
    if (json == null) return [];
    
    try {
      final List<dynamic> index = jsonDecode(json);
      final results = <Map<String, dynamic>>[];
      
      for (final entry in index) {
        final cacheKey = entry['cacheKey'];
        final data = prefs.getString(cacheKey);
        if (data != null) {
          try {
            results.add(jsonDecode(data));
          } catch (_) {}
        }
      }
      
      return results;
    } catch (e) {
      return [];
    }
  }

  /// Clear cache for a specific sub-domain
  static Future<void> clearSubDomainCache({
    required int inspectionId,
    required int subDomainId,
    required int domainId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final cacheKey = '$_cachePrefix${inspectionId}_${subDomainId}_$domainId';
    await prefs.remove(cacheKey);
    
    // Remove from index
    final indexKey = '$_indexKey$inspectionId';
    final indexJson = prefs.getString(indexKey) ?? '[]';
    final List<dynamic> index = jsonDecode(indexJson);
    index.removeWhere((e) =>
      e['subDomainId'] == subDomainId && e['domainId'] == domainId);
    await prefs.setString(indexKey, jsonEncode(index));
  }

  /// Clear all cache for an inspection (called on final submission)
  static Future<void> clearInspectionCache(int inspectionId) async {
    final prefs = await SharedPreferences.getInstance();
    final indexKey = '$_indexKey$inspectionId';
    final json = prefs.getString(indexKey);
    
    if (json != null) {
      final List<dynamic> index = jsonDecode(json);
      for (final entry in index) {
        await prefs.remove(entry['cacheKey']);
      }
    }
    
    await prefs.remove(indexKey);
  }
}