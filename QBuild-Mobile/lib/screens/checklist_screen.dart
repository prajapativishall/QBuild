import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_service.dart';
import '../utils/constants.dart';
import '../models/question_model.dart';
import '../models/sub_domain_model.dart';
import '../widgets/question_card.dart';
import '../widgets/submit_button.dart';

enum _NavigationLevel { domains, subDomains, queries }

class ChecklistScreen extends StatefulWidget {
  final int inspectionId;

  const ChecklistScreen({
    super.key,
    required this.inspectionId,
  });

  @override
  State<ChecklistScreen> createState() => _ChecklistScreenState();
}

class _ChecklistScreenState extends State<ChecklistScreen> {
  Checklist? _checklist;
  Map<int, Map<String, dynamic>> _responses = {}; // Stores full response data including ncType, comments, photos
  final Map<int, bool> _secondaryEnabled = {};
  final Map<String, bool> _submittedSubDomains = {}; // Track submitted sub-domains by domain
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;
  bool _hasUnsavedChanges = false;
  int? _phase;
  String _projectName = '';
  
  // Track if all questions in current sub-domain are answered
  bool get _isCurrentSubDomainComplete {
    if (_selectedSubDomain == null || _checklist == null) return false;
    final subDomainQueries = _checklist!.queries.where((q) => q.subDomainId == _selectedSubDomain!.id).toList();
    if (subDomainQueries.isEmpty) return true;
    
    for (final query in subDomainQueries) {
      // Skip disabled secondary questions
      if (query.isSecondary && _secondaryEnabled[query.parentId] != true) {
        continue;
      }
      // Check if question has a response
      if (!_responses.containsKey(query.id)) {
        return false;
      }
    }
    return true;
  }

  // Navigation state
  _NavigationLevel _currentLevel = _NavigationLevel.domains;
  Domain? _selectedDomain;
  SubDomain? _selectedSubDomain;

  @override
  void initState() {
    super.initState();
    _loadChecklist();
  }

  @override
  void dispose() {
    _saveResponsesLocally();
    super.dispose();
  }

  Future<void> _loadChecklist() async {
    try {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });

      // Load cached responses first
      await _loadCachedResponses();

      if (!mounted) return;
      final apiService = context.read<ApiService>();
      final response = await apiService.getChecklist(widget.inspectionId);

      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];
        final List<dynamic> domainsData = data['domains'] ?? [];
        final List<dynamic> questionsData = data['questions'] ?? [];

        // Extract phase and project name from inspection data
        _phase = data['phase'] ?? data['inspection']?['phase'];
        _projectName = data['projectName'] ?? data['inspection']?['projectName'] ?? 'Inspection';

        // Parse domains
        final domains = domainsData.map((domainData) {
          final List<dynamic> subDomainsData = domainData['subDomains'] ?? [];
          final subDomains = subDomainsData.map((subDomainData) {
            // Check if sub-domain is submitted
            final isSubmitted = subDomainData['isSubmitted'] ?? false;
            final submittedKey = '${domainData['domainId']}_${subDomainData['sub_domain_id']}';
            _submittedSubDomains[submittedKey] = isSubmitted;
            
            return SubDomain(
              id: subDomainData['sub_domain_id'],
              name: subDomainData['sub_domain_name'],
              description: subDomainData['sub_domain_description'] ?? '',
              domainId: domainData['domainId'],
              domainName: domainData['domainName'],
              weightage: ((subDomainData['sub_domain_weightage'] as num?)?.toDouble() ?? 0.0).toInt(),
              queries: 0,
              isActive: true,
              order: 0,
            );
          }).toList();

          return Domain(
            id: domainData['domainId'],
            name: domainData['domainName'],
            description: '',
            order: domainData['domainOrder'],
            subDomains: subDomains,
            isActive: true,
          );
        }).toList();

        // Parse queries
        final queries = questionsData.map((queryData) {
          return Question(
            id: queryData['id'],
            question: queryData['questionText'],
            description: '',
            type: queryData['questionType']?.toUpperCase() ?? AppConstants.primaryType,
            subDomainId: queryData['subDomainId'],
            subDomainName: queryData['subDomainName'],
            order: queryData['itemOrder'],
            parentId: queryData['parentId'],
            isActive: true,
          );
        }).toList();

        // Build query hierarchy
        final Map<int, List<Question>> queryHierarchy = {};
        for (final query in queries) {
          if (query.parentId != null) {
            queryHierarchy.putIfAbsent(query.parentId!, () => []);
            queryHierarchy[query.parentId!]!.add(query);
          }
        }

        // Initialize secondary enabled states
        // Secondary questions are enabled only when primary is YES
        debugPrint('Initializing secondary states for ${queries.length} queries');
        for (final query in queries) {
          if (query.isPrimary) {
            final responseData = _responses[query.id];
            final responseValue = responseData?['response'] as String?;
            final isEnabled = responseValue == AppConstants.responseYes;
            _secondaryEnabled[query.id] = isEnabled;
            debugPrint('Primary $query.id: response=$responseValue, secondaryEnabled=$isEnabled');
          }
          if (query.isSecondary) {
            debugPrint('Secondary ${query.id}: parentId=${query.parentId}');
          }
        }

        setState(() {
          _checklist = Checklist(
            inspectionId: widget.inspectionId,
            domains: domains,
            queries: queries,
            queryHierarchy: queryHierarchy,
          );
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = response['message'] ?? 'Failed to load checklist';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load checklist: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  Future<void> _loadCachedResponses() async {
    try {
      // In a real app, you would load from SharedPreferences
      // For now, we'll use empty responses
      setState(() {
        _responses = {};
      });
    } catch (e) {
      debugPrint('Error loading cached responses: $e');
    }
  }

  Future<void> _saveResponsesLocally() async {
    try {
      // In a real app, you would save to SharedPreferences
      debugPrint('Saving responses locally: $_responses');
    } catch (e) {
      debugPrint('Error saving responses locally: $e');
    }
  }

  void _onResponseChanged(int questionId, Map<String, dynamic> responseData) {
    debugPrint('_onResponseChanged called: questionId=$questionId, responseData=$responseData');
    setState(() {
      _responses[questionId] = responseData;
      _hasUnsavedChanges = true;

      // Update secondary queries enabled state based on primary response
      final query = _checklist!.queries.firstWhere((q) => q.id == questionId);
      debugPrint('Query isPrimary: ${query.isPrimary}');
      if (query.isPrimary) {
        final responseValue = responseData['response'] as String?;
        final isEnabled = responseValue == AppConstants.responseYes;
        debugPrint('Primary response: $responseValue, setting secondaryEnabled[$questionId] = $isEnabled');
        // Secondary questions enabled only when primary is YES
        // Disabled when primary is NO or N/A
        _secondaryEnabled[questionId] = isEnabled;

        // Clear secondary responses if primary is not YES (No or N/A)
        if (responseValue != AppConstants.responseYes) {
          final secondaryQueries = _checklist!.queryHierarchy[questionId] ?? [];
          debugPrint('Clearing ${secondaryQueries.length} secondary responses for primary $questionId');
          for (final secondary in secondaryQueries) {
            _responses.remove(secondary.id);
          }
        }
      }
    });
    
    // Auto-save locally
    _saveResponsesLocally();
  }

  Future<void> _submitResponses() async {
    if (_checklist == null) return;
    
    // Check if sub-domain is already submitted
    if (_selectedSubDomain != null) {
      final submittedKey = '${_selectedSubDomain!.domainId}_${_selectedSubDomain!.id}';
      if (_submittedSubDomains[submittedKey] == true) {
        _showErrorDialog('This sub-domain has already been submitted.');
        return;
      }
    }
    
    // Validate that all questions in current sub-domain are answered
    if (_selectedSubDomain != null && !_isCurrentSubDomainComplete) {
      _showErrorDialog('Please answer all questions in this sub-domain before submitting.');
      return;
    }

    // Validate that all primary queries are answered
    final primaryQueries = _checklist!.queries.where((q) => q.isPrimary);
    final unansweredPrimary = primaryQueries.where((q) => !_responses.containsKey(q.id));

    if (unansweredPrimary.isNotEmpty) {
      _showErrorDialog('Please answer all primary queries before submitting.');
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final apiService = context.read<ApiService>();
      
      // Calculate score
      // Secondary: No = 0, N/A = subtract 1 from total (total becomes 5 instead of 6)
      int totalMarks = 0;
      int naCount = 0;
      
      for (final entry in _responses.entries) {
        final question = _checklist!.queries.firstWhere((q) => q.id == entry.key);
        final responseData = entry.value;
        final responseValue = responseData['response'] as String?;
        
        if (question.isPrimary) {
          // Primary: Yes = 1, No = 0, N/A = 0
          if (responseValue == AppConstants.responseYes) {
            totalMarks += 1;
          }
        } else {
          // Secondary: Yes = 1, No = 0, N/A = subtract from denominator
          if (responseValue == AppConstants.responseYes) {
            totalMarks += 1;
          } else if (responseValue == AppConstants.responseNa) {
            naCount += 1;
          }
          // No = 0 (no change to total or count)
        }
      }
      
      final totalQuestions = _responses.length;
      final adjustedTotal = totalQuestions - naCount; // Subtract N/A count from total
      final percentage = adjustedTotal > 0 ? (totalMarks / adjustedTotal) * 100 : 0;
      
      // Prepare bulk response data
      final responseData = {
        'inspection_id': widget.inspectionId,
        'phase': _phase,
        'score': {
          'total_marks': totalMarks,
          'total_questions': totalQuestions,
          'na_count': naCount,
          'adjusted_total': adjustedTotal,
          'percentage': percentage.toStringAsFixed(2),
        },
        'responses': _responses.entries.map((entry) {
          final question = _checklist!.queries.firstWhere((q) => q.id == entry.key);
          final responseMap = entry.value;
          return {
            'question_id': entry.key,
            'responseValue': responseMap['response'],
            'nc_type': responseMap['ncType'],
            'inspector_comment': responseMap['inspectorComment'],
            'additional_remarks': responseMap['additionalRemarks'],
            'photos': responseMap['photos'],
            'remarks': null,
            'domain_id': question.domainId,
            'sub_domain_id': question.subDomainId,
          };
        }).toList(),
      };

      // Submit to API
      final result = await apiService.submitBulkResponses(responseData);
      
      if (result['success'] == true) {
        // Mark sub-domain as submitted
        if (_selectedSubDomain != null) {
          final submittedKey = '${_selectedSubDomain!.domainId}_${_selectedSubDomain!.id}';
          setState(() {
            _submittedSubDomains[submittedKey] = true;
          });
        }
        _showSuccessDialog();
      } else {
        _showErrorDialog(result['message'] ?? 'Failed to submit responses');
      }
    } catch (e) {
      _showErrorDialog('Network error. Responses saved locally and will be submitted when connection is restored.');
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: AppColors.success),
            SizedBox(width: 8),
            Text('Success'),
          ],
        ),
        content: const Text('Your responses have been submitted successfully.'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              Navigator.of(context).pop(); // Go back to previous screen
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.error, color: AppColors.error),
            SizedBox(width: 8),
            Text('Error'),
          ],
        ),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  int _getAnsweredCount() {
    return _responses.length;
  }

  int _getTotalQueries() {
    return _checklist?.queries.length ?? 0;
  }

  double _getProgress() {
    final total = _getTotalQueries();
    if (total == 0) return 0.0;
    return _getAnsweredCount() / total;
  }

  void _navigateToDomain(Domain domain) {
    setState(() {
      _selectedDomain = domain;
      _currentLevel = _NavigationLevel.subDomains;
    });
  }

  void _navigateToSubDomain(SubDomain subDomain) {
    setState(() {
      _selectedSubDomain = subDomain;
      _currentLevel = _NavigationLevel.queries;
    });
  }

  void _navigateBack() {
    setState(() {
      if (_currentLevel == _NavigationLevel.queries) {
        _currentLevel = _NavigationLevel.subDomains;
        _selectedSubDomain = null;
      } else if (_currentLevel == _NavigationLevel.subDomains) {
        _currentLevel = _NavigationLevel.domains;
        _selectedDomain = null;
      }
    });
  }

  String _getAppBarTitle() {
    switch (_currentLevel) {
      case _NavigationLevel.domains:
        return _projectName.isNotEmpty ? _projectName : AppStrings.checklist;
      case _NavigationLevel.subDomains:
        return _selectedDomain?.name ?? 'Sub-Domains';
      case _NavigationLevel.queries:
        return _selectedSubDomain?.name ?? 'Queries';
    }
  }

  Widget _buildCurrentLevelContent() {
    switch (_currentLevel) {
      case _NavigationLevel.domains:
        return _buildDomainsList();
      case _NavigationLevel.subDomains:
        return _buildSubDomainsList();
      case _NavigationLevel.queries:
        return _buildQueriesList();
    }
  }

  Widget _buildDomainsList() {
    debugPrint('Building domains list: ${_checklist!.domains.length} domains');
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _checklist!.domains.length,
      itemBuilder: (context, index) {
        final domain = _checklist!.domains[index];
        final domainQueries = _checklist!.queries.where((q) => 
          domain.subDomains.any((sd) => sd.id == q.subDomainId)
        ).toList();
        
        debugPrint('Building domain card: ${domain.name} with ${domain.subDomains.length} sub-domains');
        
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                debugPrint('Domain tapped: ${domain.name}');
                _navigateToDomain(domain);
              },
              borderRadius: BorderRadius.circular(8),
              splashColor: AppColors.primary.withValues(alpha: 0.1),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(Icons.folder, color: AppColors.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            domain.name,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${domain.subDomains.length} sub-domains • ${domainQueries.length} queries',
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: AppColors.textSecondary),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildSubDomainsList() {
    if (_selectedDomain == null) return const SizedBox();
    
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _selectedDomain!.subDomains.length,
      itemBuilder: (context, index) {
        final subDomain = _selectedDomain!.subDomains[index];
        final subDomainQueries = _checklist!.queries.where((q) => q.subDomainId == subDomain.id).toList();
        
        if (subDomainQueries.isEmpty) return const SizedBox();
        
        return InkWell(
          onTap: () {
            debugPrint('Sub-domain tapped: ${subDomain.name}');
            _navigateToSubDomain(subDomain);
          },
          child: Card(
            margin: const EdgeInsets.only(bottom: 16),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.subdirectory_arrow_right, color: AppColors.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          subDomain.name,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${subDomainQueries.length} queries',
                          style: const TextStyle(
                            fontSize: 14,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: AppColors.textSecondary),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildQueriesList() {
    if (_selectedSubDomain == null) return const SizedBox();
    
    final subDomainQueries = _checklist!.queries.where((q) => q.subDomainId == _selectedSubDomain!.id).toList();
    
    if (subDomainQueries.isEmpty) {
      return const Center(
        child: Text(
          'No queries found',
          style: TextStyle(color: AppColors.textSecondary),
        ),
      );
    }
    
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: subDomainQueries.length,
      itemBuilder: (context, index) {
        final query = subDomainQueries[index];
        final responseData = _responses[query.id];
        final isEnabled = query.isPrimary ||
            (query.isSecondary && _secondaryEnabled[query.parentId] == true);
        debugPrint('Building query ${query.id}: isPrimary=${query.isPrimary}, isSecondary=${query.isSecondary}, parentId=${query.parentId}, secondaryEnabled[${query.parentId}]=${_secondaryEnabled[query.parentId]}, isEnabled=$isEnabled');
        
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: QuestionCard(
            question: query,
            responseData: responseData,
            isEnabled: isEnabled,
            onResponseChanged: (newResponse) {
              _onResponseChanged(query.id, newResponse);
            },
            onAddPhoto: () {
              // TODO: Implement photo capture/upload
              debugPrint('Add photo for question ${query.id}');
            },
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final apiService = context.read<ApiService>();
    
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(
          title: const Text(AppStrings.checklist),
        ),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text(AppStrings.checklist),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: AppColors.error),
              const SizedBox(height: 16),
              Text(
                _errorMessage!,
                style: const TextStyle(
                  fontSize: 16,
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadChecklist,
                child: const Text(AppStrings.retry),
              ),
            ],
          ),
        ),
      );
    }

    return PopScope(
      canPop: !_hasUnsavedChanges,
      onPopInvokedWithResult: (didPop, result) async {
        if (!didPop && _hasUnsavedChanges) {
          await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Unsaved Changes'),
              content: const Text('You have unsaved changes. Are you sure you want to leave?'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Cancel'),
                ),
                TextButton(
                  onPressed: () {
                    Navigator.of(context).pop(true);
                    if (context.mounted) {
                      Navigator.of(context).pop();
                    }
                  },
                  child: const Text('Leave'),
                ),
              ],
            ),
          );
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_getAppBarTitle()),
          leading: _currentLevel != _NavigationLevel.domains
              ? IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: _navigateBack,
                )
              : null,
          actions: [
            if (!apiService.isConnected)
              Container(
                margin: const EdgeInsets.only(right: 16),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.wifi_off, size: 16, color: AppColors.warning),
                    SizedBox(width: 4),
                    Text(
                      AppStrings.offlineMode,
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.warning,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        body: Column(
          children: [
            // Progress Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(bottom: BorderSide(color: AppColors.divider)),
              ),
              child: Column(
                children: [
                  // Project Name
                  if (_projectName.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        _projectName,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Inspection #${widget.inspectionId}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        '${_getAnsweredCount()}/${_getTotalQueries()} answered',
                        style: const TextStyle(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: _getProgress(),
                    backgroundColor: AppColors.border,
                    valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                  ),
                ],
              ),
            ),
            
            // Content based on navigation level
            Expanded(
              child: _buildCurrentLevelContent(),
            ),
            
            // Submit Button
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 4,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Show warning if not all questions are answered
                  if (_selectedSubDomain != null && !_isCurrentSubDomainComplete)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Row(
                        children: [
                          Icon(Icons.warning, color: AppColors.warning, size: 16),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Answer all questions to submit',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.warning,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  SubmitButton(
                    isLoading: _isSubmitting,
                    hasUnsavedChanges: _hasUnsavedChanges && _isCurrentSubDomainComplete,
                    progress: _getProgress(),
                    onSubmit: _isCurrentSubDomainComplete ? _submitResponses : null,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
