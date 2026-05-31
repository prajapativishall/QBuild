import 'package:json_annotation/json_annotation.dart';
import 'sub_domain_model.dart';
import '../utils/constants.dart';

part 'question_model.g.dart';

@JsonSerializable()
class Question {
  final int id;
  final String question;
  final String description;
  final String type;
  final int subDomainId;
  final String subDomainName;
  final int? domainId;
  final String? domainName;
  final int? parentId;
  final int order;
  final bool isActive;

  const Question({
    required this.id,
    required this.question,
    required this.description,
    required this.type,
    required this.subDomainId,
    required this.subDomainName,
    this.domainId,
    this.domainName,
    this.parentId,
    required this.order,
    required this.isActive,
  });

  factory Question.fromJson(Map<String, dynamic> json) => _$QuestionFromJson(json);
  Map<String, dynamic> toJson() => _$QuestionToJson(this);

  bool get isPrimary => type == AppConstants.primaryType;
  bool get isSecondary => type == AppConstants.secondaryType;
  bool get hasParent => parentId != null;

  Question copyWith({
    int? id,
    String? question,
    String? description,
    String? type,
    int? subDomainId,
    String? subDomainName,
    int? parentId,
    int? order,
    bool? isActive,
  }) {
    return Question(
      id: id ?? this.id,
      question: question ?? this.question,
      description: description ?? this.description,
      type: type ?? this.type,
      subDomainId: subDomainId ?? this.subDomainId,
      subDomainName: subDomainName ?? this.subDomainName,
      parentId: parentId ?? this.parentId,
      order: order ?? this.order,
      isActive: isActive ?? this.isActive,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Question &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'Question{id: $id, type: $type, question: $question}';
  }
}

@JsonSerializable()
class Response {
  final int? id;
  final int inspectionId;
  final int checklistItemId;
  final String responseValue;
  final String? remarks;
  final String? ncType; // Non-Conformance type: Critical, Major, Minor, OFI
  final String? inspectorComment; // Inspector comment/observation
  final String? additionalRemarks; // Additional remarks/special instructions
  final List<String>? photos; // Site photos URLs/paths
  final int? submittedBy;
  final bool isOverridden;
  final int? overriddenBy;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Response({
    this.id,
    required this.inspectionId,
    required this.checklistItemId,
    required this.responseValue,
    this.remarks,
    this.ncType,
    this.inspectorComment,
    this.additionalRemarks,
    this.photos,
    this.submittedBy,
    this.isOverridden = false,
    this.overriddenBy,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Response.fromJson(Map<String, dynamic> json) => _$ResponseFromJson(json);
  Map<String, dynamic> toJson() => _$ResponseToJson(this);

  Response copyWith({
    int? id,
    int? inspectionId,
    int? checklistItemId,
    String? responseValue,
    String? remarks,
    String? ncType,
    String? inspectorComment,
    String? additionalRemarks,
    List<String>? photos,
    int? submittedBy,
    bool? isOverridden,
    int? overriddenBy,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Response(
      id: id ?? this.id,
      inspectionId: inspectionId ?? this.inspectionId,
      checklistItemId: checklistItemId ?? this.checklistItemId,
      responseValue: responseValue ?? this.responseValue,
      remarks: remarks ?? this.remarks,
      ncType: ncType ?? this.ncType,
      inspectorComment: inspectorComment ?? this.inspectorComment,
      additionalRemarks: additionalRemarks ?? this.additionalRemarks,
      photos: photos ?? this.photos,
      submittedBy: submittedBy ?? this.submittedBy,
      isOverridden: isOverridden ?? this.isOverridden,
      overriddenBy: overriddenBy ?? this.overriddenBy,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Response &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'Response{id: $id, value: $responseValue, checklistItemId: $checklistItemId}';
  }
}

@JsonSerializable()
class Inspection {
  final int id;
  final int projectId;
  final String projectName;
  final String engineer;
  final String status;
  final int? score;
  final String? startDate;
  final String? endDate;
  final int totalQueries;
  final int answeredQueries;
  final int issues;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Inspection({
    required this.id,
    required this.projectId,
    required this.projectName,
    required this.engineer,
    required this.status,
    this.score,
    this.startDate,
    this.endDate,
    required this.totalQueries,
    required this.answeredQueries,
    required this.issues,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Inspection.fromJson(Map<String, dynamic> json) => _$InspectionFromJson(json);
  Map<String, dynamic> toJson() => _$InspectionToJson(this);

  bool get isPending => status == AppConstants.statusPending;
  bool get isInProgress => status == AppConstants.statusInProgress;
  bool get isCompleted => status == AppConstants.statusCompleted;

  double get progress => totalQueries > 0
      ? (answeredQueries / totalQueries) * 100
      : 0.0;

  Inspection copyWith({
    int? id,
    int? projectId,
    String? projectName,
    String? engineer,
    String? status,
    int? score,
    String? startDate,
    String? endDate,
    int? totalQueries,
    int? answeredQueries,
    int? issues,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Inspection(
      id: id ?? this.id,
      projectId: projectId ?? this.projectId,
      projectName: projectName ?? this.projectName,
      engineer: engineer ?? this.engineer,
      status: status ?? this.status,
      score: score ?? this.score,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      totalQueries: totalQueries ?? this.totalQueries,
      answeredQueries: answeredQueries ?? this.answeredQueries,
      issues: issues ?? this.issues,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Inspection &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'Inspection{id: $id, project: $projectName, status: $status}';
  }
}

@JsonSerializable()
class Checklist {
  final int inspectionId;
  final List<Domain> domains;
  final List<Question> queries;
  final Map<int, List<Question>> queryHierarchy;

  const Checklist({
    required this.inspectionId,
    required this.domains,
    required this.queries,
    required this.queryHierarchy,
  });

  Checklist copyWith({
    int? inspectionId,
    List<Domain>? domains,
    List<Question>? queries,
    Map<int, List<Question>>? queryHierarchy,
  }) {
    return Checklist(
      inspectionId: inspectionId ?? this.inspectionId,
      domains: domains ?? this.domains,
      queries: queries ?? this.queries,
      queryHierarchy: queryHierarchy ?? this.queryHierarchy,
    );
  }

  factory Checklist.fromJson(Map<String, dynamic> json) => _$ChecklistFromJson(json);
  Map<String, dynamic> toJson() => _$ChecklistToJson(this);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Checklist &&
          runtimeType == other.runtimeType &&
          inspectionId == other.inspectionId &&
          domains == other.domains &&
          queries == other.queries &&
          queryHierarchy == other.queryHierarchy;

  @override
  int get hashCode =>
      inspectionId.hashCode ^
      domains.hashCode ^
      queries.hashCode ^
      queryHierarchy.hashCode;

  @override
  String toString() {
    return 'Checklist{inspectionId: $inspectionId, domains: ${domains.length}, queries: ${queries.length}}';
  }
}
