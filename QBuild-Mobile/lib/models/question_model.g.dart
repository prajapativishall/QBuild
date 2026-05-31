// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'question_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Question _$QuestionFromJson(Map<String, dynamic> json) => Question(
  id: (json['id'] as num).toInt(),
  question: json['question'] as String,
  description: json['description'] as String,
  type: json['type'] as String,
  subDomainId: (json['subDomainId'] as num).toInt(),
  subDomainName: json['subDomainName'] as String,
  parentId: (json['parentId'] as num?)?.toInt(),
  order: (json['order'] as num).toInt(),
  isActive: json['isActive'] as bool,
);

Map<String, dynamic> _$QuestionToJson(Question instance) => <String, dynamic>{
  'id': instance.id,
  'question': instance.question,
  'description': instance.description,
  'type': instance.type,
  'subDomainId': instance.subDomainId,
  'subDomainName': instance.subDomainName,
  'parentId': instance.parentId,
  'order': instance.order,
  'isActive': instance.isActive,
};

Response _$ResponseFromJson(Map<String, dynamic> json) => Response(
  id: (json['id'] as num?)?.toInt(),
  inspectionId: (json['inspectionId'] as num).toInt(),
  checklistItemId: (json['checklistItemId'] as num).toInt(),
  responseValue: json['responseValue'] as String,
  remarks: json['remarks'] as String?,
  submittedBy: (json['submittedBy'] as num?)?.toInt(),
  isOverridden: json['isOverridden'] as bool? ?? false,
  overriddenBy: (json['overriddenBy'] as num?)?.toInt(),
  createdAt: DateTime.parse(json['createdAt'] as String),
  updatedAt: DateTime.parse(json['updatedAt'] as String),
);

Map<String, dynamic> _$ResponseToJson(Response instance) => <String, dynamic>{
  'id': instance.id,
  'inspectionId': instance.inspectionId,
  'checklistItemId': instance.checklistItemId,
  'responseValue': instance.responseValue,
  'remarks': instance.remarks,
  'submittedBy': instance.submittedBy,
  'isOverridden': instance.isOverridden,
  'overriddenBy': instance.overriddenBy,
  'createdAt': instance.createdAt.toIso8601String(),
  'updatedAt': instance.updatedAt.toIso8601String(),
};

Inspection _$InspectionFromJson(Map<String, dynamic> json) => Inspection(
  id: (json['id'] as num).toInt(),
  projectId: (json['projectId'] as num).toInt(),
  projectName: json['projectName'] as String,
  engineer: json['engineer'] as String,
  status: json['status'] as String,
  score: (json['score'] as num?)?.toInt(),
  startDate: json['startDate'] as String?,
  endDate: json['endDate'] as String?,
  totalQueries: (json['totalQueries'] as num).toInt(),
  answeredQueries: (json['answeredQueries'] as num).toInt(),
  issues: (json['issues'] as num).toInt(),
  createdAt: DateTime.parse(json['createdAt'] as String),
  updatedAt: DateTime.parse(json['updatedAt'] as String),
);

Map<String, dynamic> _$InspectionToJson(Inspection instance) =>
    <String, dynamic>{
      'id': instance.id,
      'projectId': instance.projectId,
      'projectName': instance.projectName,
      'engineer': instance.engineer,
      'status': instance.status,
      'score': instance.score,
      'startDate': instance.startDate,
      'endDate': instance.endDate,
      'totalQueries': instance.totalQueries,
      'answeredQueries': instance.answeredQueries,
      'issues': instance.issues,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

Checklist _$ChecklistFromJson(Map<String, dynamic> json) => Checklist(
  inspectionId: (json['inspectionId'] as num).toInt(),
  domains: (json['domains'] as List<dynamic>)
      .map((e) => Domain.fromJson(e as Map<String, dynamic>))
      .toList(),
  queries: (json['queries'] as List<dynamic>)
      .map((e) => Question.fromJson(e as Map<String, dynamic>))
      .toList(),
  queryHierarchy: (json['queryHierarchy'] as Map<String, dynamic>).map(
    (k, e) => MapEntry(
      int.parse(k),
      (e as List<dynamic>)
          .map((e) => Question.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  ),
);

Map<String, dynamic> _$ChecklistToJson(Checklist instance) => <String, dynamic>{
  'inspectionId': instance.inspectionId,
  'domains': instance.domains,
  'queries': instance.queries,
  'queryHierarchy': instance.queryHierarchy.map(
    (k, e) => MapEntry(k.toString(), e),
  ),
};
