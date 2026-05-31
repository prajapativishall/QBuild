import 'package:flutter/material.dart';
import '../utils/constants.dart';
import '../models/question_model.dart';
import 'primary_question.dart';
import 'secondary_question.dart';

class QuestionCard extends StatelessWidget {
  final Question question;
  final Map<String, dynamic>? responseData;
  final bool isEnabled;
  final Function(Map<String, dynamic>) onResponseChanged;
  final VoidCallback? onAddPhoto;

  const QuestionCard({
    super.key,
    required this.question,
    this.responseData,
    required this.isEnabled,
    required this.onResponseChanged,
    this.onAddPhoto,
  });

  @override
  Widget build(BuildContext context) {
    debugPrint('QuestionCard build - questionId=${question.id}, isPrimary=${question.isPrimary}, response=$responseData, isEnabled=$isEnabled');
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
        border: Border.all(
          color: isEnabled ? AppColors.primary.withValues(alpha: 0.3) : AppColors.border,
          width: isEnabled ? 1.5 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Question Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: question.isPrimary 
                        ? AppColors.primary.withValues(alpha: 0.1)
                        : AppColors.surface,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: question.isPrimary 
                          ? AppColors.primary.withValues(alpha: 0.3)
                          : AppColors.border,
                    ),
                  ),
                  child: Text(
                    question.isPrimary ? AppStrings.primaryQuestion : AppStrings.secondaryQuestion,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: question.isPrimary ? AppColors.primary : AppColors.textSecondary,
                    ),
                  ),
                ),
                const Spacer(),
                if (!isEnabled)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.textHint.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'Disabled',
                      style: TextStyle(
                        fontSize: 10,
                        color: AppColors.textHint,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
              ],
            ),
            
            const SizedBox(height: 12),
            
            // Question Text
            Text(
              question.question,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: isEnabled ? AppColors.textPrimary : AppColors.textHint,
              ),
            ),
            
            if (question.description.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                question.description,
                style: TextStyle(
                  fontSize: 14,
                  color: isEnabled ? AppColors.textSecondary : AppColors.textHint,
                ),
              ),
            ],
            
            const SizedBox(height: 16),
            
            // Response Options
            if (question.isPrimary)
              PrimaryQuestion(
                response: responseData?['response'] as String?,
                ncType: responseData?['ncType'] as String?,
                inspectorComment: responseData?['inspectorComment'] as String?,
                additionalRemarks: responseData?['additionalRemarks'] as String?,
                photos: responseData?['photos']?.cast<String>(),
                isEnabled: isEnabled,
                onResponseChanged: onResponseChanged,
                onAddPhoto: onAddPhoto,
              )
            else
              SecondaryQuestion(
                response: responseData?['response'] as String?,
                ncType: responseData?['ncType'] as String?,
                inspectorComment: responseData?['inspectorComment'] as String?,
                additionalRemarks: responseData?['additionalRemarks'] as String?,
                photos: responseData?['photos']?.cast<String>(),
                isEnabled: isEnabled,
                onResponseChanged: onResponseChanged,
                onAddPhoto: onAddPhoto,
              ),
          ],
        ),
      ),
    );
  }
}
