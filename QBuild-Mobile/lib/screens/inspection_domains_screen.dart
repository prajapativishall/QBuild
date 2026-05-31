import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../services/api_service.dart';
import '../utils/constants.dart';

class InspectionDomainsScreen extends StatefulWidget {
  final int inspectionId;
  const InspectionDomainsScreen({super.key, required this.inspectionId});

  @override
  State<InspectionDomainsScreen> createState() => _InspectionDomainsScreenState();
}

class _InspectionDomainsScreenState extends State<InspectionDomainsScreen> {
  List<dynamic> _domains = [];
  bool _isLoading = true;
  String? _errorMessage;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadDomains();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reload domains when screen becomes visible again (after navigation back from subdomains)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _loadDomains();
      }
    });
  }

  Future<void> _loadDomains() async {
    try {
      setState(() { _isLoading = true; _errorMessage = null; });
      final apiService = context.read<ApiService>();
      final response = await apiService.getInspectionDomains(widget.inspectionId);
      
      if (response['success'] == true) {
        setState(() {
          _domains = response['data']['domains'] ?? [];
          _isLoading = false;
        });
      } else {
        setState(() { _errorMessage = response['message']; _isLoading = false; });
      }
    } catch (e) {
      setState(() { _errorMessage = e.toString(); _isLoading = false; });
    }
  }

  Future<void> _submitFinalInspection() async {
    if (_isSubmitting) return;

    // Check if all domains have all sub-domains submitted
    bool allDomainsComplete = true;
    for (final domain in _domains) {
      final subDomains = domain['subDomains'] as List? ?? [];
      final submittedCount = subDomains.where((sd) => sd['isSubmitted'] == true).length;
      if (submittedCount < subDomains.length) {
        allDomainsComplete = false;
        break;
      }
    }

    if (!allDomainsComplete) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please complete all sub-domains before submitting'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() { _isSubmitting = true; });

    try {
      final apiService = context.read<ApiService>();
      
      // Submit each domain separately
      for (final domain in _domains) {
        final domainId = domain['domainId'];
        final response = await apiService.submitFinalInspection(widget.inspectionId, domainId);
        
        if (!mounted) return;
        
        if (response['success'] != true) {
          throw Exception(response['message'] ?? 'Failed to submit domain');
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Inspection submitted successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        
          // Navigate back to dashboard which will auto-refresh on initState
          await Future.delayed(const Duration(seconds: 1));
          if (mounted) {
            context.go('/dashboard');
          }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() { _isSubmitting = false; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Check if all domains are complete for submit button
    bool allDomainsComplete = false;
    if (!_isLoading && _errorMessage == null) {
      allDomainsComplete = true;
      for (final domain in _domains) {
        final subDomains = domain['subDomains'] as List? ?? [];
        final submittedCount = subDomains.where((sd) => sd['isSubmitted'] == true).length;
        if (submittedCount < subDomains.length) {
          allDomainsComplete = false;
          break;
        }
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Domains')),
      body: _isLoading ? const Center(child: CircularProgressIndicator())
        : _errorMessage != null ? Center(child: Text(_errorMessage!))
        : ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _domains.length,
            itemBuilder: (context, index) {
              final domain = _domains[index];
              final subDomains = domain['subDomains'] as List? ?? [];
              final subCount = subDomains.length;
              final allSubmitted = domain['allSubDomainsSubmitted'] ?? false;
              final submittedCount = subDomains.where((sd) => sd['isSubmitted'] == true).length;

              return Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: allSubmitted ? Colors.green : AppColors.primary,
                    child: Icon(allSubmitted ? Icons.check : Icons.folder, color: Colors.white),
                  ),
                  title: Text(domain['domainName'] ?? 'Unknown'),
                  subtitle: Text('$submittedCount/$subCount sub-domains submitted'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.go('/dashboard/inspection/${widget.inspectionId}/domains/${domain['domainId']}/subdomains'),
                ),
              );
            },
          ),
      floatingActionButton: allDomainsComplete ? FloatingActionButton.extended(
        onPressed: _isSubmitting ? null : _submitFinalInspection,
        backgroundColor: _isSubmitting ? Colors.grey : Colors.green,
        icon: _isSubmitting ? const SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
        ) : const Icon(Icons.check),
        label: Text(_isSubmitting ? 'Submitting...' : 'Submit Inspection'),
      ) : null,
    );
  }
}
