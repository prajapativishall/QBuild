import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';

import '../services/api_service.dart';
import '../utils/constants.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  List<dynamic> _inspections = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadInbox();
  }

  Future<void> _loadInbox() async {
    try {
      setState(() { _isLoading = true; _errorMessage = null; });
      final apiService = context.read<ApiService>();
      final response = await apiService.getInbox();
      
      if (response['success'] == true && response['data'] != null) {
        setState(() {
          _inspections = response['data'];
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = response['message'] ?? 'Failed to load inbox';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load inbox: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  Future<void> _acceptInspection(dynamic inspection) async {
    try {
      final apiService = context.read<ApiService>();
      final response = await apiService.acceptInspection(inspection['id']);
      
      if (!mounted) return;
      if (response['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Inspection accepted successfully'))
        );
        // Navigate back to dashboard which will auto-refresh on initState
        context.go('/dashboard');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(response['message'] ?? 'Failed to accept'))
        );
        _loadInbox();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}'))
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inbox'),
        // Refresh button removed - auto-refresh handles updates
      ),
      body: RefreshIndicator(
        onRefresh: _loadInbox,
        child: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
            ? _buildErrorWidget()
            : _inspections.isEmpty
              ? _buildEmptyWidget()
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _inspections.length,
                  itemBuilder: (context, index) => _buildInspectionCard(_inspections[index]),
                ),
      ),
    );
  }

  Widget _buildInspectionCard(dynamic inspection) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        inspection['project_name'] ?? inspection['projectName'] ?? 'Unknown Project',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        inspection['location'] ?? '',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Pending',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.warning),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (inspection['projectDescription'] != null && inspection['projectDescription'].toString().isNotEmpty)
              Text(
                inspection['projectDescription'],
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _acceptInspection(inspection),
                icon: const Icon(Icons.check, size: 18),
                label: const Text('Accept Inspection'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.success,
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorWidget() => Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.error_outline, size: 64, color: AppColors.error),
        const SizedBox(height: 16),
        Text(_errorMessage ?? AppStrings.error, style: const TextStyle(fontSize: 16, color: AppColors.textSecondary)),
        const SizedBox(height: 16),
        ElevatedButton(onPressed: _loadInbox, child: const Text(AppStrings.retry)),
      ],
    ),
  );

  Widget _buildEmptyWidget() => const Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.inbox_outlined, size: 64, color: AppColors.textHint),
        SizedBox(height: 16),
        Text('No pending inspections', style: TextStyle(fontSize: 16, color: AppColors.textSecondary)),
      ],
    ),
  );
}
