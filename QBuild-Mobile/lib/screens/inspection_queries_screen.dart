import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';

import '../services/api_service.dart';
import '../services/local_cache_service.dart';
import '../utils/constants.dart';

class InspectionQueriesScreen extends StatefulWidget {
  final int inspectionId;
  final int domainId;
  final int subDomainId;
  final List<int>? subDomainIds;
  final Map<int, Map<String, dynamic>>? accumulatedResponses;
  
  const InspectionQueriesScreen({
    super.key, 
    required this.inspectionId, 
    required this.domainId, 
    required this.subDomainId,
    this.subDomainIds,
    this.accumulatedResponses,
  });

  @override
  State<InspectionQueriesScreen> createState() => _InspectionQueriesScreenState();
}

class _InspectionQueriesScreenState extends State<InspectionQueriesScreen> {
  List<dynamic> _queries = [];
  bool _isLoading = true;
  String? _errorMessage;

  // All queries are always enabled
  bool _debugPhotoPicker(int queryId, String? responseValue, bool isPrimary, int? parentId, bool isEnabled) {
    final shouldShow = !_isSubmitted && isEnabled;
    return shouldShow;
  }
  
  // Local response state: queryId -> {response, ncType, inspectorComment, additionalRemarks}
  final Map<int, Map<String, dynamic>> _responses = {};
  // Store local photo files for each query (queryId -> List<File>)
  final Map<int, List<File>> _localPhotos = {};
  // Store uploaded photo URLs for each query (queryId -> List<String>)
  final Map<int, List<String>> _uploadedPhotos = {};
  // Persistent text controllers for inspector comments (queryId -> TextEditingController)
  final Map<int, TextEditingController> _inspectorControllers = {};
  // Persistent text controllers for additional remarks (queryId -> TextEditingController)
  final Map<int, TextEditingController> _remarksControllers = {};
  // Persistent focus nodes for inspector comments (queryId -> FocusNode)
  final Map<int, FocusNode> _inspectorFocusNodes = {};
  // Persistent focus nodes for additional remarks (queryId -> FocusNode)
  final Map<int, FocusNode> _remarksFocusNodes = {};
  int? _phase;
  bool _isSubmitted = false;
  bool _isSubmitting = false;
  
  // Image picker instance
  final ImagePicker _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _loadQueries();
  }

  // Get or create a persistent controller for inspector comments
  TextEditingController _getInspectorController(int queryId, String? initialValue) {
    if (!_inspectorControllers.containsKey(queryId)) {
      _inspectorControllers[queryId] = TextEditingController(text: initialValue ?? '');
      _inspectorFocusNodes[queryId] = FocusNode();
    } else {
      final controller = _inspectorControllers[queryId]!;
      final focusNode = _inspectorFocusNodes[queryId]!;
      if (controller.text != (initialValue ?? '') && !focusNode.hasFocus) {
        controller.text = initialValue ?? '';
      }
    }
    return _inspectorControllers[queryId]!;
  }

  // Get or create a persistent controller for additional remarks
  TextEditingController _getRemarksController(int queryId, String? initialValue) {
    if (!_remarksControllers.containsKey(queryId)) {
      _remarksControllers[queryId] = TextEditingController(text: initialValue ?? '');
      _remarksFocusNodes[queryId] = FocusNode();
    } else {
      final controller = _remarksControllers[queryId]!;
      final focusNode = _remarksFocusNodes[queryId]!;
      if (controller.text != (initialValue ?? '') && !focusNode.hasFocus) {
        controller.text = initialValue ?? '';
      }
    }
    return _remarksControllers[queryId]!;
  }

  FocusNode _getInspectorFocusNode(int queryId) {
    if (!_inspectorFocusNodes.containsKey(queryId)) {
      _inspectorFocusNodes[queryId] = FocusNode();
    }
    return _inspectorFocusNodes[queryId]!;
  }

  FocusNode _getRemarksFocusNode(int queryId) {
    if (!_remarksFocusNodes.containsKey(queryId)) {
      _remarksFocusNodes[queryId] = FocusNode();
    }
    return _remarksFocusNodes[queryId]!;
  }

  @override
  void dispose() {
    for (final controller in _inspectorControllers.values) {
      controller.dispose();
    }
    for (final controller in _remarksControllers.values) {
      controller.dispose();
    }
    for (final focusNode in _inspectorFocusNodes.values) {
      focusNode.dispose();
    }
    for (final focusNode in _remarksFocusNodes.values) {
      focusNode.dispose();
    }
    super.dispose();
  }

  void _initializeSecondaryEnabled() {
    // All queries are always enabled
  }

  /// Extract photos from a query response.
  /// The backend returns the field as 'photos' (from SQL: r.photos),
  /// which may be a JSON string or already-parsed list.
  List<String> _extractPhotos(dynamic query) {
    // Backend returns field name 'photos' (SQL alias from r.photos)
    final raw = query['photos'];
    if (raw == null) return [];
    if (raw is List) {
      return raw.map((e) => e.toString()).toList();
    }
    if (raw is String) {
      try {
        final parsed = jsonDecode(raw);
        if (parsed is List) {
          return parsed.map((e) => e.toString()).toList();
        }
      } catch (_) {}
    }
    return [];
  }

  Future<void> _loadQueries() async {
    try {
      if (!mounted) return;
      setState(() { _isLoading = true; _errorMessage = null; });
      
      // Step 1: Try loading from local cache first (for fresh inspections)
      final cachedData = await LocalCacheService.getCachedSubDomainData(
        inspectionId: widget.inspectionId,
        subDomainId: widget.subDomainId,
        domainId: widget.domainId,
      );
      
      if (cachedData != null && !mounted) return;
      
      if (cachedData != null) {
        debugPrint('Loaded sub-domain ${widget.subDomainId} from local cache');
        final cachedResponses = cachedData['responses'] as List<dynamic>? ?? [];
        final cachedPhotos = cachedData['uploadedPhotos'] as Map<int, List<String>>? ?? {};
        
        final apiService = context.read<ApiService>();
        final response = await apiService.getSubDomainQueries(widget.inspectionId, widget.subDomainId, widget.domainId);
        
        if (response['success'] == true) {
          final queries = response['data']['queries'] ?? [];
          if (queries.isNotEmpty) {
            _phase = queries[0]['phase'] ?? queries[0]['inspection_phase'];
          }
          
          _localPhotos.clear();
          _uploadedPhotos.clear();
          _responses.clear();
          
          for (final query in queries) {
            final queryId = query['id'] as int;
            
            if (cachedPhotos.containsKey(queryId)) {
              _uploadedPhotos[queryId] = List<String>.from(cachedPhotos[queryId]!);
            } else {
              _uploadedPhotos[queryId] = _extractPhotos(query);
            }
            
            final cachedResp = cachedResponses.cast<Map<String, dynamic>>().firstWhere(
              (r) => r['question_id'] == queryId || r['questionId'] == queryId,
              orElse: () => <String, dynamic>{},
            );
            
            if (cachedResp.isNotEmpty && cachedResp['responseValue'] != null) {
              _responses[queryId] = {
                'response': cachedResp['responseValue'],
                'ncType': cachedResp['nc_type'],
                'inspectorComment': cachedResp['inspector_comment'],
                'additionalRemarks': cachedResp['additional_remarks'],
              };
            } else if (query['response'] != null && query['response'].toString().isNotEmpty) {
              _responses[queryId] = {
                'response': query['response'],
                'ncType': query['nc_type'],
                'inspectorComment': query['inspector_comment'],
                'additionalRemarks': query['additional_remarks'],
              };
            }
          }
          
          _queries = queries;
          _initializeSecondaryEnabled();
          if (mounted) {
            setState(() {
              _isSubmitted = response['data']['isSubmitted'] ?? false;
              _isLoading = false;
            });
          }
          return;
        }
      }
      
      // Step 2: Fall back to full API load (for rejected inspections or first-time load)
      debugPrint('Loading sub-domain ${widget.subDomainId} from API');
      final apiService = context.read<ApiService>();
      final response = await apiService.getSubDomainQueries(widget.inspectionId, widget.subDomainId, widget.domainId);

      if (response['success'] == true) {
        final queries = response['data']['queries'] ?? [];
        if (queries.isNotEmpty) {
          _phase = queries[0]['phase'] ?? queries[0]['inspection_phase'];
        }
        
        _localPhotos.clear();
        _uploadedPhotos.clear();
        _responses.clear();
        
        for (final query in queries) {
          _uploadedPhotos[query['id']] = _extractPhotos(query);
          
          if (query['response'] != null && query['response'].toString().isNotEmpty) {
            _responses[query['id']] = {
              'response': query['response'],
              'ncType': query['nc_type'],
              'inspectorComment': query['inspector_comment'],
              'additionalRemarks': query['additional_remarks'],
            };
          }
        }
        
        _queries = queries;
        _initializeSecondaryEnabled();
        if (mounted) {
          setState(() {
            _isSubmitted = response['data']['isSubmitted'] ?? false;
            _isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() { _errorMessage = response['message']; _isLoading = false; });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() { _errorMessage = e.toString(); _isLoading = false; });
      }
    }
  }

  bool get _allQueriesAnswered {
    if (_queries.isEmpty) return false;
    return _queries.every((q) {
      final queryId = q['id'] as int;
      return _responses.containsKey(queryId) && 
             _responses[queryId]?['response'] != null && 
             _responses[queryId]!['response'].toString().isNotEmpty;
    });
  }

  void _updateResponse(int queryId, String value) {
    setState(() {
      _responses[queryId] = {
        'response': value,
        'ncType': value == 'NO' ? (_responses[queryId]?['ncType'] ?? '') : null,
        'inspectorComment': _responses[queryId]?['inspectorComment'] ?? '',
        'additionalRemarks': _responses[queryId]?['additionalRemarks'] ?? '',
      };
      
    });
  }
  
  void _updateNcType(int queryId, String? ncType) {
    setState(() {
      if (_responses.containsKey(queryId)) {
        _responses[queryId]!['ncType'] = ncType;
      }
    });
  }
  
  void _updateInspectorComment(int queryId, String comment) {
    setState(() {
      if (_responses.containsKey(queryId)) {
        _responses[queryId]!['inspectorComment'] = comment;
      }
    });
  }
  
  void _updateAdditionalRemarks(int queryId, String remarks) {
    setState(() {
      if (_responses.containsKey(queryId)) {
        _responses[queryId]!['additionalRemarks'] = remarks;
      }
    });
  }

  // Photo picker from camera
  Future<void> _pickPhotoFromCamera(int queryId) async {
    debugPrint('=== CAMERA PICKER CALLED for query $queryId ===');
    try {
      final XFile? photo = await _imagePicker.pickImage(
        source: ImageSource.camera,
        imageQuality: 80,
        maxWidth: 1920,
        maxHeight: 1080,
      );
      if (photo != null) {
        setState(() {
          _localPhotos.putIfAbsent(queryId, () => []);
          _localPhotos[queryId]!.add(File(photo.path));
        });
      }
    } catch (e) {
      debugPrint('Error picking photo from camera: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error opening camera: $e')),
        );
      }
    }
  }

  // Photo picker from gallery
  Future<void> _pickPhotoFromGallery(int queryId) async {
    debugPrint('=== GALLERY PICKER CALLED for query $queryId ===');
    try {
      final XFile? photo = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 80,
        maxWidth: 1920,
        maxHeight: 1080,
      );
      if (photo != null) {
        setState(() {
          _localPhotos.putIfAbsent(queryId, () => []);
          _localPhotos[queryId]!.add(File(photo.path));
        });
      }
    } catch (e) {
      debugPrint('Error picking photo from gallery: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error opening gallery: $e')),
        );
      }
    }
  }

  void _removeLocalPhoto(int queryId, int index) {
    setState(() {
      if (_localPhotos.containsKey(queryId) && index < _localPhotos[queryId]!.length) {
        _localPhotos[queryId]!.removeAt(index);
        if (_localPhotos[queryId]!.isEmpty) {
          _localPhotos.remove(queryId);
        }
      }
    });
  }

  void _removeUploadedPhoto(int queryId, int index) {
    setState(() {
      if (_uploadedPhotos.containsKey(queryId) && index < _uploadedPhotos[queryId]!.length) {
        _uploadedPhotos[queryId]!.removeAt(index);
        if (_uploadedPhotos[queryId]!.isEmpty) {
          _uploadedPhotos.remove(queryId);
        }
      }
    });
  }

  int? get _nextSubDomainId {
    if (widget.subDomainIds == null || widget.subDomainIds!.isEmpty) return null;
    final currentIndex = widget.subDomainIds!.indexOf(widget.subDomainId);
    if (currentIndex < 0 || currentIndex >= widget.subDomainIds!.length - 1) return null;
    return widget.subDomainIds![currentIndex + 1];
  }

  Future<void> _onContinueOrSubmit() async {
    await _submitCurrentSubDomainAndContinue();
  }

  Future<void> _submitCurrentSubDomainAndContinue() async {
    if (_isSubmitting) return;

    if (!mounted) return;
    setState(() { _isSubmitting = true; });

    try {
      final apiService = context.read<ApiService>();
      
      final Map<int, List<String>> allPhotos = {};
      for (final query in _queries) {
        final queryId = query['id'] as int;
        if (_uploadedPhotos.containsKey(queryId)) {
          allPhotos[queryId] = List<String>.from(_uploadedPhotos[queryId]!);
        } else {
          allPhotos[queryId] = [];
        }
      }
      
      for (final queryId in _localPhotos.keys) {
        if (!allPhotos.containsKey(queryId)) {
          allPhotos[queryId] = [];
        }
        for (final photoFile in _localPhotos[queryId]!) {
          try {
            final uploadResult = await apiService.uploadInspectionPhoto(
              inspectionId: widget.inspectionId,
              domainId: widget.domainId,
              queryId: queryId,
              subDomainId: widget.subDomainId,
              phase: _phase ?? 1,
              photoFile: photoFile,
            );
            if (uploadResult['success'] == true && uploadResult['url'] != null) {
              final photoUrl = uploadResult['url'] as String;
              allPhotos[queryId]!.add(photoUrl);
              _uploadedPhotos.putIfAbsent(queryId, () => []);
              _uploadedPhotos[queryId]!.add(photoUrl);
            }
          } catch (e) {
            debugPrint('Error uploading photo for query $queryId: $e');
          }
        }
      }

      // Before building the payload, clear _uploadedPhotos for any query changed to YES
      // so the local cache doesn't retain stale photos
      for (final q in _queries) {
        final queryId = q['id'] as int;
        if (_responses.containsKey(queryId) && _responses[queryId]!['response'] == 'YES') {
          // Remove photos from local state since YES responses should not have evidence photos
          _uploadedPhotos.remove(queryId);
          if (allPhotos.containsKey(queryId)) {
            allPhotos[queryId] = [];
          }
        }
      }

      final responsesPayload = _queries.where((q) {
        final queryId = q['id'] as int;
        if (!_responses.containsKey(queryId)) {
          debugPrint('Skipping question $queryId - no response available');
          return false;
        }
        return true;
      }).map((q) {
        final queryId = q['id'] as int;
        final responseData = _responses[queryId]!;
        return {
          'question_id': queryId,
          'responseValue': responseData['response'],
          'nc_type': responseData['ncType'],
          'inspector_comment': responseData['inspectorComment'],
          'additional_remarks': responseData['additionalRemarks'],
          'site_photos': allPhotos[queryId] ?? [],
        };
      }).toList();

      for (final q in _queries) {
        final queryId = q['id'] as int;
        if (!_responses.containsKey(queryId)) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Please answer all questions before submitting')),
            );
          }
          setState(() { _isSubmitting = false; });
          return;
        }
        final responseData = _responses[queryId]!;
        final responseValue = responseData['response'] as String?;
        final ncType = responseData['ncType'] as String?;
        if (responseValue == 'NO' && (ncType == null || ncType.isEmpty)) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Please select Non-Conformance Type for all NO responses'),
                backgroundColor: Colors.red,
              ),
            );
          }
          setState(() { _isSubmitting = false; });
          return;
        }
      }

      final response = await apiService.submitSubDomainResponses(
        inspectionId: widget.inspectionId,
        subDomainId: widget.subDomainId,
        domainId: widget.domainId,
        responses: responsesPayload,
      );

      if (mounted) {
        if (response['success'] == true) {
          try {
            await LocalCacheService.cacheSubDomainData(
              inspectionId: widget.inspectionId,
              subDomainId: widget.subDomainId,
              domainId: widget.domainId,
              responses: responsesPayload,
              uploadedPhotos: _uploadedPhotos,
            );
            debugPrint('Cached sub-domain data locally for subDomainId: ${widget.subDomainId}');
          } catch (cacheError) {
            debugPrint('Failed to cache sub-domain data: $cacheError');
          }

          setState(() {
            _isSubmitted = true;
            _isSubmitting = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Sub-domain submitted successfully!')),
          );

          await Future.delayed(const Duration(milliseconds: 500));

          if (mounted) {
            context.go(
              '/dashboard/inspection/${widget.inspectionId}/domains/${widget.domainId}/subdomains',
            );
          }
        } else {
          setState(() { _isSubmitting = false; });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['message'] ?? 'Failed to submit')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() { _isSubmitting = false; });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Queries'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard/inspection/${widget.inspectionId}/domains/${widget.domainId}/subdomains'),
        ),
      ),
      body: _isLoading ? const Center(child: CircularProgressIndicator())
        : _errorMessage != null ? Center(child: Text(_errorMessage!))
        : Column(
            children: [
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _queries.length,
                  itemBuilder: (context, index) {
                    final query = _queries[index];
                    final queryId = query['id'] as int;
                    final isPrimary = query['query_type'] == 'primary';
                    final parentId = query['parent_id'] as int?;
                    
                    final isEnabled = true;
                    
                    final responseData = _responses[queryId];
                    final responseValue = responseData?['response'] as String?;
                    final ncType = responseData?['ncType'] as String?;
                    final inspectorComment = responseData?['inspectorComment'] as String?;
                    final additionalRemarks = responseData?['additionalRemarks'] as String?;
                    
                    final showNcDropdown = responseValue == 'NO';
                    final hasPhotos = _uploadedPhotos[queryId]?.isNotEmpty ?? false;
                    final hasLocalPhotos = _localPhotos[queryId]?.isNotEmpty ?? false;

                    return Card(
                      margin: const EdgeInsets.only(bottom: 16),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Question text with colored badge - Primary=Red, Secondary=Blue
                            Row(
                              children: [
                                Container(
                                  margin: const EdgeInsets.only(right: 8),
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: isPrimary ? Colors.red.shade600 : Colors.blue.shade600,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    isPrimary ? 'P' : 'S',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: Text(query['question_text'] ?? 'No question',
                                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            
                            // Response buttons
                            Row(
                              children: [
                                _buildResponseButton(query, 'YES', responseValue, Colors.green, isEnabled),
                                const SizedBox(width: 8),
                                _buildResponseButton(query, 'NO', responseValue, Colors.red, isEnabled),
                                const SizedBox(width: 8),
                                _buildResponseButton(query, 'NA', responseValue, Colors.grey, isEnabled),
                              ],
                            ),
                            
                            // NC Type Dropdown (when NO is selected)
                            if (showNcDropdown)
                              Container(
                                margin: const EdgeInsets.only(top: 12),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.red.withValues(alpha: 0.05),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Non-Conformance Type:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                                    const SizedBox(height: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(color: Colors.grey.shade300),
                                      ),
                                      child: DropdownButtonHideUnderline(
                                        child: DropdownButton<String>(
                                          isExpanded: true,
                                          value: ncType?.isNotEmpty == true ? ncType : null,
                                          hint: const Text('Select NC Type'),
                                          onChanged: isEnabled && !_isSubmitted ? (value) => _updateNcType(queryId, value) : null,
                                          items: ['Critical', 'Major', 'Minor', 'OFI'].map((type) {
                                            return DropdownMenuItem<String>(
                                              value: type,
                                              child: Text(type),
                                            );
                                          }).toList(),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            
                            // Inspector Notes (when NO is selected)
                            if (showNcDropdown)
                              Container(
                                margin: const EdgeInsets.only(top: 12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Inspector Comment:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                                    const SizedBox(height: 8),
                                    TextField(
                                      onChanged: (value) => _updateInspectorComment(queryId, value),
                                      enabled: isEnabled && !_isSubmitted,
                                      focusNode: _getInspectorFocusNode(queryId),
                                      decoration: const InputDecoration(
                                        hintText: 'Enter inspector comment...',
                                        border: OutlineInputBorder(),
                                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                      ),
                                      maxLines: 2,
                                      controller: _getInspectorController(queryId, inspectorComment),
                                    ),
                                  ],
                                ),
                              ),
                            
                            // Additional Remarks (only visible when NO)
                            if (responseValue == 'NO')
                              Container(
                                margin: const EdgeInsets.only(top: 12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Additional Remarks:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                                    const SizedBox(height: 8),
                                    TextField(
                                      onChanged: (value) => _updateAdditionalRemarks(queryId, value),
                                      enabled: isEnabled && !_isSubmitted,
                                      decoration: const InputDecoration(
                                        hintText: 'Enter additional remarks...',
                                        border: OutlineInputBorder(),
                                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                      ),
                                      maxLines: 2,
                                      controller: _getRemarksController(queryId, additionalRemarks),
                                    ),
                                  ],
                                ),
                              ),
                            
                            // Site Photos Section (only when NO - photos are only captured for non-conformances)
                            if (responseValue == 'NO')
                              Container(
                                margin: const EdgeInsets.only(top: 16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Site Photos:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                                    const SizedBox(height: 8),
                                  
                                  // Photo picker buttons
                                  if (_debugPhotoPicker(queryId, responseValue, isPrimary, parentId, isEnabled))
                                    Row(
                                      children: [
                                        Expanded(
                                          child: ElevatedButton.icon(
                                            onPressed: () {
                                              debugPrint('=== CAMERA BUTTON CLICKED ===');
                                              debugPrint('Query ID: $queryId');
                                              debugPrint('Inspection ID: ${widget.inspectionId}');
                                              _pickPhotoFromCamera(queryId);
                                            },
                                            icon: const Icon(Icons.camera_alt, size: 18),
                                            label: const Text('Camera'),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.blue.shade600,
                                              foregroundColor: Colors.white,
                                              padding: const EdgeInsets.symmetric(vertical: 10),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: OutlinedButton.icon(
                                            onPressed: () {
                                              debugPrint('=== GALLERY BUTTON CLICKED ===');
                                              debugPrint('Query ID: $queryId');
                                              debugPrint('Inspection ID: ${widget.inspectionId}');
                                              _pickPhotoFromGallery(queryId);
                                            },
                                            icon: const Icon(Icons.photo_library, size: 18),
                                            label: const Text('Gallery'),
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor: Colors.blue.shade600,
                                              side: BorderSide(color: Colors.blue.shade600),
                                              padding: const EdgeInsets.symmetric(vertical: 10),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  
                                  const SizedBox(height: 8),
                                  
                                  // Photo thumbnails
                                  if (hasLocalPhotos || hasPhotos)
                                    SizedBox(
                                      height: 80,
                                      child: ListView(
                                        scrollDirection: Axis.horizontal,
                                        children: [
                                          // Local photos (not yet uploaded)
                                          ...(_localPhotos[queryId] ?? []).asMap().entries.map((entry) {
                                            final index = entry.key;
                                            final file = entry.value;
                                            return Container(
                                              width: 80,
                                              margin: const EdgeInsets.only(right: 8),
                                              child: Stack(
                                                fit: StackFit.expand,
                                                children: [
                                                  ClipRRect(
                                                    borderRadius: BorderRadius.circular(8),
                                                    child: kIsWeb
                                                        ? Image.network(
                                                            file.path,
                                                            fit: BoxFit.cover,
                                                          )
                                                        : Image.file(
                                                            file,
                                                            fit: BoxFit.cover,
                                                          ),
                                                  ),
                                                  if (!_isSubmitted)
                                                    Positioned(
                                                      top: 4,
                                                      right: 4,
                                                      child: GestureDetector(
                                                        onTap: () => _removeLocalPhoto(queryId, index),
                                                        child: Container(
                                                          decoration: const BoxDecoration(
                                                            color: Colors.red,
                                                            shape: BoxShape.circle,
                                                          ),
                                                          padding: const EdgeInsets.all(4),
                                                          child: const Icon(
                                                            Icons.close,
                                                            size: 14,
                                                            color: Colors.white,
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                  Positioned(
                                                    bottom: 4,
                                                    left: 4,
                                                    child: Container(
                                                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                                      decoration: BoxDecoration(
                                                        color: Colors.orange.withValues(alpha: 0.8),
                                                        borderRadius: BorderRadius.circular(4),
                                                      ),
                                                      child: const Text(
                                                        'Local',
                                                        style: TextStyle(
                                                          fontSize: 10,
                                                          color: Colors.white,
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            );
                                          }),
                                          
                                          // Uploaded photos - prepend base URL since paths are relative
                                          ...(_uploadedPhotos[queryId] ?? []).asMap().entries.map((entry) {
                                            final index = entry.key;
                                            final relativePath = entry.value;
                                            // Build full URL: strip "/api" from baseUrl, append the relative path
                                            final baseUrl = AppConstants.baseUrl;
                                            final serverUrl = baseUrl.endsWith('/api')
                                                ? baseUrl.substring(0, baseUrl.length - 4)
                                                : baseUrl;
                                            final fullUrl = relativePath.startsWith('http')
                                                ? relativePath
                                                : '$serverUrl$relativePath';
                                            return Container(
                                              width: 80,
                                              margin: const EdgeInsets.only(right: 8),
                                              child: Stack(
                                                fit: StackFit.expand,
                                                children: [
                                                  ClipRRect(
                                                    borderRadius: BorderRadius.circular(8),
                                                    child: Image.network(
                                                      fullUrl,
                                                      fit: BoxFit.cover,
                                                      loadingBuilder: (context, child, progress) {
                                                        if (progress == null) return child;
                                                        return Center(
                                                          child: CircularProgressIndicator(
                                                            value: progress.expectedTotalBytes != null
                                                                ? progress.cumulativeBytesLoaded / progress.expectedTotalBytes!
                                                                : null,
                                                          ),
                                                        );
                                                      },
                                                      errorBuilder: (context, error, stackTrace) {
                                                        return Container(
                                                          color: Colors.grey.shade300,
                                                          child: const Icon(Icons.error),
                                                        );
                                                      },
                                                    ),
                                                  ),
                                                  if (!_isSubmitted)
                                                    Positioned(
                                                      top: 4,
                                                      right: 4,
                                                      child: GestureDetector(
                                                        onTap: () => _removeUploadedPhoto(queryId, index),
                                                        child: Container(
                                                          decoration: const BoxDecoration(
                                                            color: Colors.red,
                                                            shape: BoxShape.circle,
                                                          ),
                                                          padding: const EdgeInsets.all(4),
                                                          child: const Icon(
                                                            Icons.close,
                                                            size: 14,
                                                            color: Colors.white,
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                  Positioned(
                                                    bottom: 4,
                                                    left: 4,
                                                    child: Container(
                                                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                                      decoration: BoxDecoration(
                                                        color: Colors.green.withValues(alpha: 0.8),
                                                        borderRadius: BorderRadius.circular(4),
                                                      ),
                                                      child: const Text(
                                                        'Uploaded',
                                                        style: TextStyle(
                                                          fontSize: 10,
                                                          color: Colors.white,
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            );
                                          }),
                                        ],
                                      ),
                                    ),
                                  
                                  // No photos message
                                    if (_debugPhotoPicker(queryId, responseValue, isPrimary, parentId, isEnabled) &&
                                        !hasLocalPhotos && !hasPhotos)
                                    Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: Colors.grey.shade100,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: Colors.grey.shade300),
                                      ),
                                      child: Row(
                                        children: [
                                          const Icon(Icons.photo, color: Colors.grey, size: 20),
                                          const SizedBox(width: 8),
                                          Text(
                                            'No photos added',
                                            style: TextStyle(
                                              color: Colors.grey.shade600,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              // Single Submit Button
              if (!_isSubmitted)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: (_isSubmitting || !_allQueriesAnswered)
                          ? null
                          : _onContinueOrSubmit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor:
                        _allQueriesAnswered ? Colors.red : Colors.grey,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                          : const Text(
                        'Submit',
                        style: TextStyle(fontSize: 16),
                      ),
                    ),
                  ),
                ),
              if (_isSubmitted)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: Colors.green.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        'Submitted',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.green.shade700,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
    );
  }

  Widget _buildResponseButton(dynamic query, String value, String? selected, Color color, bool isEnabled) {
    final isSelected = selected == value;
    return Expanded(
      child: ElevatedButton(
        onPressed: (_isSubmitted || !isEnabled) ? null : () => _updateResponse(query['id'] as int, value),
        style: ElevatedButton.styleFrom(
          backgroundColor: isSelected ? color : color.withValues(alpha: 0.1),
          foregroundColor: isSelected ? Colors.white : color,
        ),
        child: Text(value),
      ),
    );
  }
}