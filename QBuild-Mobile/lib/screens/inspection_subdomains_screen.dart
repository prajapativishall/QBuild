import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../services/api_service.dart';
import '../utils/constants.dart';

class InspectionSubDomainsScreen extends StatefulWidget {
  final int inspectionId;
  final int domainId;
  
  const InspectionSubDomainsScreen({super.key, required this.inspectionId, required this.domainId});

  @override
  State<InspectionSubDomainsScreen> createState() => _InspectionSubDomainsScreenState();
}

class _InspectionSubDomainsScreenState extends State<InspectionSubDomainsScreen> {
  List<dynamic> _subDomains = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _domainName = '';

  @override
  void initState() {
    super.initState();
    _loadSubDomains();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reload data when navigating back to this screen
    _loadSubDomains();
  }

  Future<void> _loadSubDomains() async {
    try {
      setState(() { _isLoading = true; _errorMessage = null; });
      final apiService = context.read<ApiService>();
      final response = await apiService.getInspectionDomains(widget.inspectionId);
      
      if (response['success'] == true) {
        final domains = response['data']['domains'] ?? [];
        final domain = domains.firstWhere((d) => d['domainId'] == widget.domainId, orElse: () => null);
        
        if (domain != null) {
          setState(() {
            _subDomains = domain['subDomains'] ?? [];
            _domainName = domain['domainName'] ?? 'Domain';
            _isLoading = false;
          });
        } else {
          setState(() { _errorMessage = 'Domain not found'; _isLoading = false; });
        }
      } else {
        setState(() { _errorMessage = response['message']; _isLoading = false; });
      }
    } catch (e) {
      setState(() { _errorMessage = e.toString(); _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_domainName),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard/inspection/${widget.inspectionId}/domains'),
        ),
      ),
      body: _isLoading ? const Center(child: CircularProgressIndicator())
        : _errorMessage != null ? Center(child: Text(_errorMessage!))
        : ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _subDomains.length,
            itemBuilder: (context, index) {
              final sub = _subDomains[index];
              final isSubmitted = sub['isSubmitted'] ?? false;
              return Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: isSubmitted ? Colors.green : AppColors.info,
                    child: Icon(isSubmitted ? Icons.check : Icons.subdirectory_arrow_right, color: Colors.white),
                  ),
                  title: Text(sub['sub_domain_name'] ?? 'Unknown'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    // Extract all sub-domain IDs to pass for navigation flow
                    final subDomainIds = _subDomains.map<int>((s) => s['sub_domain_id'] as int).toList();
                    context.go('/dashboard/inspection/${widget.inspectionId}/domains/${widget.domainId}/subdomains/${sub['sub_domain_id']}/queries',
                      extra: {'subDomainIds': subDomainIds},
                    );
                  },
                ),
              );
            },
          ),
    );
  }
}
