import 'package:flutter/material.dart';
import '../utils/constants.dart';

class SubmitButton extends StatelessWidget {
  final bool isLoading;
  final bool hasUnsavedChanges;
  final double progress;
  final VoidCallback? onSubmit;

  const SubmitButton({
    super.key,
    required this.isLoading,
    required this.hasUnsavedChanges,
    required this.progress,
    this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final isComplete = progress >= 1.0;
    
    return Column(
      children: [
        // Progress Info
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isComplete 
                ? AppColors.success.withValues(alpha: 0.1)
                : hasUnsavedChanges 
                    ? AppColors.warning.withValues(alpha: 0.1)
                    : AppColors.surface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isComplete 
                  ? AppColors.success.withValues(alpha: 0.3)
                  : hasUnsavedChanges 
                      ? AppColors.warning.withValues(alpha: 0.3)
                      : AppColors.border,
            ),
          ),
          child: Row(
            children: [
              Icon(
                isComplete 
                    ? Icons.check_circle 
                    : hasUnsavedChanges 
                        ? Icons.warning 
                        : Icons.info_outline,
                size: 20,
                color: isComplete 
                    ? AppColors.success 
                    : hasUnsavedChanges 
                        ? AppColors.warning 
                        : AppColors.info,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  isComplete
                      ? 'All queries answered. Ready to submit!'
                      : hasUnsavedChanges
                          ? 'You have unsaved changes'
                          : 'Complete all queries to submit',
                  style: TextStyle(
                    fontSize: 14,
                    color: isComplete 
                        ? AppColors.success 
                        : hasUnsavedChanges 
                            ? AppColors.warning 
                            : AppColors.info,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 12),
        
        // Submit Button
        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: (isComplete && !isLoading && onSubmit != null) ? onSubmit : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: isComplete 
                  ? AppColors.success 
                  : AppColors.surface,
              foregroundColor: isComplete 
                  ? Colors.white 
                  : AppColors.textHint,
              elevation: isComplete ? 2 : 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: isLoading
                ? const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      ),
                      SizedBox(width: 12),
                      Text('Submitting...'),
                    ],
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        isComplete ? Icons.check_circle : Icons.lock,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isComplete
                            ? AppStrings.submit
                            : 'Complete All Queries',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
        
        // Additional Info
        if (!isComplete)
          Container(
            margin: const EdgeInsets.only(top: 8),
            child: Text(
              'Progress: ${(progress * 100).toStringAsFixed(1)}%',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ),
      ],
    );
  }
}
