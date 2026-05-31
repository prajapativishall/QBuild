import 'package:flutter/material.dart';
import '../utils/constants.dart';

class SecondaryQuestion extends StatefulWidget {
  final String? response;
  final String? ncType;
  final String? inspectorComment;
  final String? additionalRemarks;
  final List<String>? photos;
  final bool isEnabled;
  final Function(Map<String, dynamic>) onResponseChanged;
  final VoidCallback? onAddPhoto;

  const SecondaryQuestion({
    super.key,
    this.response,
    this.ncType,
    this.inspectorComment,
    this.additionalRemarks,
    this.photos,
    required this.isEnabled,
    required this.onResponseChanged,
    this.onAddPhoto,
  });

  @override
  State<SecondaryQuestion> createState() => _SecondaryQuestionState();
}

class _SecondaryQuestionState extends State<SecondaryQuestion> {
  late TextEditingController _inspectorCommentController;
  late TextEditingController _additionalRemarksController;
  bool _showNotes = false;

  @override
  void initState() {
    super.initState();
    _inspectorCommentController = TextEditingController(text: widget.inspectorComment ?? '');
    _additionalRemarksController = TextEditingController(text: widget.additionalRemarks ?? '');
  }

  @override
  void dispose() {
    _inspectorCommentController.dispose();
    _additionalRemarksController.dispose();
    super.dispose();
  }

  void _updateResponse(String responseValue) {
    widget.onResponseChanged({
      'response': responseValue,
      'ncType': responseValue == AppConstants.responseNo ? (widget.ncType ?? '') : null,
      'inspectorComment': _inspectorCommentController.text,
      'additionalRemarks': _additionalRemarksController.text,
      'photos': widget.photos,
    });
  }

  void _updateNcType(String? ncType) {
    widget.onResponseChanged({
      'response': widget.response,
      'ncType': ncType,
      'inspectorComment': _inspectorCommentController.text,
      'additionalRemarks': _additionalRemarksController.text,
      'photos': widget.photos,
    });
  }

  void _updateNotes() {
    widget.onResponseChanged({
      'response': widget.response,
      'ncType': widget.ncType,
      'inspectorComment': _inspectorCommentController.text,
      'additionalRemarks': _additionalRemarksController.text,
      'photos': widget.photos,
    });
  }

  @override
  Widget build(BuildContext context) {
    debugPrint('SecondaryQuestion build - response: ${widget.response}, isEnabled: ${widget.isEnabled}');
    final bool showNcDropdown = widget.response == AppConstants.responseNo && widget.isEnabled;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Response Buttons
        Row(
          children: [
            // YES Button
            Expanded(
              child: _buildResponseButton(
                text: AppStrings.responseYes,
                color: AppColors.success,
                isSelected: widget.response == AppConstants.responseYes,
                isEnabled: widget.isEnabled,
                onTap: () => _updateResponse(AppConstants.responseYes),
              ),
            ),
            const SizedBox(width: 12),
            // NO Button
            Expanded(
              child: _buildResponseButton(
                text: AppStrings.responseNo,
                color: AppColors.error,
                isSelected: widget.response == AppConstants.responseNo,
                isEnabled: widget.isEnabled,
                onTap: () => _updateResponse(AppConstants.responseNo),
              ),
            ),
            const SizedBox(width: 12),
            // NA Button
            Expanded(
              child: _buildResponseButton(
                text: AppStrings.responseNa,
                color: AppColors.textSecondary,
                isSelected: widget.response == AppConstants.responseNa,
                isEnabled: widget.isEnabled,
                onTap: () => _updateResponse(AppConstants.responseNa),
              ),
            ),
          ],
        ),

        // NC Type Dropdown (when NO is selected)
        if (showNcDropdown)
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Non-Conformance Type:',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      value: widget.ncType?.isNotEmpty == true ? widget.ncType : null,
                      hint: const Text('Select NC Type'),
                      onChanged: (value) => _updateNcType(value),
                      items: AppConstants.ncTypes.map((String type) {
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

        // Notes Toggle Button
        if (widget.isEnabled && (widget.response == AppConstants.responseNo || widget.response == AppConstants.responseYes))
          Container(
            margin: const EdgeInsets.only(top: 12),
            child: InkWell(
              onTap: () => setState(() => _showNotes = !_showNotes),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                decoration: BoxDecoration(
                  color: _showNotes ? AppColors.primary.withValues(alpha: 0.1) : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: _showNotes ? AppColors.primary : AppColors.border,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _showNotes ? Icons.notes : Icons.notes_outlined,
                      size: 18,
                      color: _showNotes ? AppColors.primary : AppColors.textSecondary,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _showNotes ? 'Hide Notes' : 'Add Notes',
                      style: TextStyle(
                        fontSize: 14,
                        color: _showNotes ? AppColors.primary : AppColors.textSecondary,
                        fontWeight: _showNotes ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

        // Notes Section (Inspector Comment + Additional Remarks)
        if (_showNotes && widget.isEnabled)
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Inspector Comment
                const Text(
                  'INSPECTOR COMMENT',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _inspectorCommentController,
                  onChanged: (_) => _updateNotes(),
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: 'Observation, measurement, test result, photo ref...',
                    hintStyle: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textHint,
                    ),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.primary, width: 2),
                    ),
                    contentPadding: const EdgeInsets.all(12),
                  ),
                ),

                const SizedBox(height: 16),

                // Additional Remarks
                const Text(
                  'ADDITIONAL REMARKS / SPECIAL INSTRUCTIONS',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _additionalRemarksController,
                  onChanged: (_) => _updateNotes(),
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: 'Site-specific note, deviation, NCR reference, hold point...',
                    hintStyle: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textHint,
                    ),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.primary, width: 2),
                    ),
                    contentPadding: const EdgeInsets.all(12),
                  ),
                ),
              ],
            ),
          ),

        // Site Photos
        if (_showNotes && widget.isEnabled)
          Container(
            margin: const EdgeInsets.only(top: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'SITE PHOTOS',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 12),
                // Photo Grid
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    // Add Photo Button
                    if (widget.onAddPhoto != null)
                      InkWell(
                        onTap: widget.onAddPhoto,
                        child: Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: AppColors.border,
                              style: BorderStyle.solid,
                            ),
                          ),
                          child: const Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.camera_alt,
                                size: 28,
                                color: AppColors.textSecondary,
                              ),
                              SizedBox(height: 4),
                              Text(
                                'Add Photo',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    // Existing Photos
                    if (widget.photos != null)
                      ...widget.photos!.map((photo) => Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade200,
                          borderRadius: BorderRadius.circular(8),
                          image: photo.startsWith('http')
                              ? DecorationImage(
                                  image: NetworkImage(photo),
                                  fit: BoxFit.cover,
                                )
                              : null,
                        ),
                        child: photo.startsWith('http')
                            ? null
                            : const Icon(
                                Icons.image,
                                size: 32,
                                color: AppColors.textSecondary,
                              ),
                      )),
                  ],
                ),
              ],
            ),
          ),

        // Help Text - Disabled Secondary
        if (!widget.isEnabled)
          Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.info.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.info.withValues(alpha: 0.3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.lock_outline, size: 16, color: AppColors.info),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Secondary questions are disabled when primary is answered "NO" or "N/A"',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.info,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildResponseButton({
    required String text,
    required Color color,
    required bool isSelected,
    required bool isEnabled,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: isEnabled ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 48,
        decoration: BoxDecoration(
          color: isSelected 
              ? color 
              : isEnabled 
                  ? Colors.white 
                  : AppColors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected 
                ? color 
                : isEnabled 
                    ? AppColors.border 
                    : AppColors.textHint.withValues(alpha: 0.3),
            width: 2,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: color.withValues(alpha: 0.3),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Center(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isSelected 
                  ? Colors.white 
                  : isEnabled 
                      ? color 
                      : AppColors.textHint,
            ),
          ),
        ),
      ),
    );
  }
}
