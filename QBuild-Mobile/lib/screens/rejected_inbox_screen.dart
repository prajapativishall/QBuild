import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qbuild_mobile/services/api_service.dart';

class RejectedInboxScreen extends StatefulWidget {
  const RejectedInboxScreen({super.key});

  @override
  State<RejectedInboxScreen> createState() => _RejectedInboxScreenState();
}

class _RejectedInboxScreenState extends State<RejectedInboxScreen> {
  final List<Map<String, dynamic>> _rejectedInspections = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadRejectedInspections();
  }

  Future<void> _loadRejectedInspections() async {
    if (!mounted) return;
    
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final apiService = context.read<ApiService>();
      final response = await apiService.getRejectedInspections();
      
      if (mounted) {
        setState(() {
          _rejectedInspections.clear();
          if (response['success'] == true && response['data'] != null) {
            _rejectedInspections.addAll(List<Map<String, dynamic>>.from(response['data']));
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _acceptRejection(int inspectionId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Accept Rejection'),
        content: const Text('This will reopen the inspection for editing. Do you want to continue?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Accept'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    if (!mounted) return;

    try {
      final apiService = context.read<ApiService>();
      final response = await apiService.acceptRejection(inspectionId);
      
      if (mounted) {
        if (response['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Rejection accepted. Inspection is now open for editing.')),
          );
          // Navigate back to dashboard which will auto-refresh on initState
          context.go('/dashboard');
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['message'] ?? 'Failed to accept rejection')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
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
        title: const Text('Rejected Inspections'),
        backgroundColor: Colors.red,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: Colors.red),
                      const SizedBox(height: 16),
                      Text(
                        _errorMessage!,
                        style: const TextStyle(color: Colors.red),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadRejectedInspections,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _rejectedInspections.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inbox, size: 64, color: Colors.grey),
                          SizedBox(height: 16),
                          Text(
                            'No rejected inspections',
                            style: TextStyle(fontSize: 18, color: Colors.grey),
                          ),
                          SizedBox(height: 8),
                          Text(
                            'Great job! All your inspections have been approved.',
                            style: TextStyle(color: Colors.grey),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadRejectedInspections,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _rejectedInspections.length,
                        itemBuilder: (context, index) {
                          final inspection = _rejectedInspections[index];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 16),
                            child: ListTile(
                              title: Text(
                                'Inspection #${inspection['id']}',
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 4),
                                  Text('Project: ${inspection['project_name']}'),
                                  Text('Phase: ${inspection['phase']}'),
                                  if (inspection['reviewer_notes'] != null) ...[
                                    const SizedBox(height: 8),
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: Colors.red.shade50,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: Colors.red.shade200),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'Reviewer Comments:',
                                            style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              color: Colors.red,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            inspection['reviewer_notes'],
                                            style: const TextStyle(color: Colors.red),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 4),
                                  Text(
                                    'Reviewed by: ${inspection['reviewer_name'] ?? 'Unknown'}',
                                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                                  ),
                                  Text(
                                    'Reviewed at: ${inspection['reviewed_at'] != null ? DateTime.parse(inspection['reviewed_at']).toString().split('.')[0] : 'N/A'}',
                                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                                  ),
                                ],
                              ),
                              trailing: ElevatedButton(
                                onPressed: () => _acceptRejection(inspection['id']),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.blue,
                                ),
                                child: const Text('Accept & Edit'),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
