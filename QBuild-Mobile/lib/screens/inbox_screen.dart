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
        elevation: 0,
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
    final location = inspection['location'] ?? inspection['site_address'] ?? '';
    final phase = inspection['phase'] ?? '';
    final projectName = inspection['project_name'] ?? inspection['projectName'] ?? 'Unknown Project';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    Icons.pending_actions_outlined,
                    color: AppColors.warning,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        projectName,
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      if (location.isNotEmpty)
                        Row(
                          children: [
                            Icon(Icons.location_on_outlined, size: 14, color: Colors.grey.shade500),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                location,
                                style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'Pending',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.warning),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            // Only show phase info, no description
            Row(
              children: [
                if (phase != null && phase.toString().isNotEmpty) ...[
                  Icon(Icons.layers_outlined, size: 16, color: Colors.grey.shade500),
                  const SizedBox(width: 4),
                  Text(
                    'Phase $phase',
                    style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                  ),
                  const SizedBox(width: 16),
                ],
                Icon(Icons.calendar_today_outlined, size: 14, color: Colors.grey.shade500),
                const SizedBox(width: 4),
                Text(
                  'Assigned today',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                ),
              ],
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: () => _acceptInspection(inspection),
                icon: const Icon(Icons.check_circle_outline, size: 20),
                label: const Text('Accept Inspection'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFB00020),
                  foregroundColor: Colors.white,
                  elevation: 2,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(30),
                  ),
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

  Widget _buildEmptyWidget() => Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Icon(Icons.inbox_outlined, size: 40, color: AppColors.textHint),
        ),
        const SizedBox(height: 20),
        const Text(
          'No pending inspections',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 8),
        Text(
          'New assigned inspections will appear here',
          style: TextStyle(fontSize: 14, color: Colors.grey.shade400),
        ),
      ],
    ),
  );
}